#!/usr/bin/env python3
"""ASR 2.0 nostream 连调: TTS 合成 16kHz pcm -> websocket 喂 ASR -> 验证转写闭环"""
import asyncio, gzip, json, struct, sys, urllib.request, uuid, base64
from pathlib import Path
import websockets

HERMES_ENV = Path.home() / '.hermes/.env'
key = next((l.split('=', 1)[1].strip() for l in HERMES_ENV.read_text().splitlines()
            if l.startswith('WEB_SEARCH_API_KEY') and 'ark-' in l), '')

TEXT = '今天天气很好,我们一起来做火山方舟语音识别的闭环测试。'

# ---------- 第1步: TTS 合成 16kHz pcm ----------
def tts_pcm():
    url = 'https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional'
    payload = {'req_params': {
        'text': TEXT, 'speaker': 'zh_female_vv_uranus_bigtts',
        'audio_params': {'format': 'pcm', 'sample_rate': 16000}}}
    req = urllib.request.Request(url, method='POST', headers={
        'X-Api-Key': key, 'X-Api-Resource-Id': 'seed-tts-2.0',
        'Content-Type': 'application/json'}, data=json.dumps(payload).encode())
    pcm = b''
    for line in urllib.request.urlopen(req, timeout=60).read().decode().splitlines():
        obj = json.loads(line)
        if obj.get('data'):
            pcm += base64.b64decode(obj['data'])
    print(f'[TTS] pcm bytes={len(pcm)} ({len(pcm)/32000:.1f}s @16kHz/16bit)')
    Path('/tmp/asr_test.pcm').write_bytes(pcm)
    return pcm

# ---------- 第2步: 协议帧构造 (大端) ----------
POS_SEQ = 0b0001   # header flags: payload 带正序号
def header(msg_type, flags, serial, comp):
    return bytes([0b0001_0001, (msg_type << 4) | flags, (serial << 4) | comp, 0x00])

async def asr_nostream(pcm):
    uri = 'wss://openspeech.bytedance.com/api/v3/plan/sauc/bigmodel_nostream'
    headers = {'X-Api-Key': key, 'X-Api-Resource-Id': 'volc.seedasr.sauc.duration',
               'X-Api-Request-Id': str(uuid.uuid4()), 'X-Api-Connect-Id': str(uuid.uuid4())}
    async with websockets.connect(uri, additional_headers=headers, max_size=10*1024*1024) as ws:
        # 首包: FULL_CLIENT(0b0001) flags=带seq(0b0001) JSON(0b0001)+gzip(0b0001)
        first = {'user': {'uid': 'cece-test'},
                 'audio': {'format': 'pcm', 'rate': 16000, 'bits': 16, 'channel': 1},
                 'request': {'model_name': 'bigmodel', 'enable_punc': True, 'enable_itn': True},
                 'sequence': 1}
        body = gzip.compress(json.dumps(first).encode())
        seq_b = struct.pack('>i', 1)
        hdr = header(0b0001, POS_SEQ, 0b0001, 0b0001)
        await ws.send(hdr + seq_b + struct.pack('>I', len(body)) + body)
        print('[ASR] first frame sent')

        # 音频包: AUDIO_ONLY(0b0010) raw+raw; flags bit0=带seq, bit1=末包; 6400B/包(200ms), 末包负seq
        CH = 6400
        chunks = [pcm[i:i+CH] for i in range(0, len(pcm), CH)]
        for i, ch in enumerate(chunks):
            seq = i + 2
            last = (i == len(chunks) - 1)
            flags = 0b0011 if last else 0b0001
            if last:
                seq = -seq  # 负序号 = 最后一包
            hdr = header(0b0010, flags, 0b0000, 0b0000)
            await ws.send(hdr + struct.pack('>i', seq) + struct.pack('>I', len(ch)) + ch)
            await asyncio.sleep(0.15 if not last else 0)
        print(f'[ASR] {len(chunks)} audio chunks sent (last seq={seq}, flags=0b{flags:04b})')

        # 收响应: FULL_SERVER(0b1001) / ERROR(0b1111)
        result_text = ''
        while True:
            resp = await asyncio.wait_for(ws.recv(), timeout=30)
            if isinstance(resp, str):
                print('[ASR] text frame:', resp[:200]); continue
            b0, b1, b2, _b3 = resp[:4]
            mtype = (b1 >> 4) & 0x0f
            flags = b1 & 0x0f
            comp = b2 & 0x0f
            off = 4
            if flags & 0b0001:  # 带 seq
                off += 4
            size = struct.unpack('>I', resp[off:off+4])[0]
            off += 4
            payload = resp[off:off+size]
            if comp == 0b0001:
                payload = gzip.decompress(payload)
            if mtype == 0b1111:
                print('[ASR] ❌ ERROR frame:', payload[:300].decode(errors='replace'))
                return None
            obj = json.loads(payload)
            result_text = obj.get('result', {}).get('text', '')
            print(f'[ASR] server resp: {json.dumps(obj, ensure_ascii=False)[:260]}')
            if result_text or obj.get('result', {}).get('is_end') or 'sequence' in obj and obj['sequence'] < 0:
                break
        return result_text

pcm = tts_pcm()
text = asyncio.run(asr_nostream(pcm))
print('\n===== 闭环判定 =====')
print('TTS 输入 :', TEXT)
print('ASR 转写 :', text or '(无结果)')
if text:
    core_t = TEXT.replace(',', '').replace('。', '').replace(' ', '')
    core_a = text.replace(',', '').replace('。', '').replace(' ', '').replace('，', '').replace('．', '')
    match = core_a[:12] in core_t or core_t[:12] in core_a
    print('闭环判定 :', '✅ PASS (内容匹配)' if match else '⚠️ 内容有差异, 人工核对')
else:
    print('闭环判定 : ❌ FAIL')
