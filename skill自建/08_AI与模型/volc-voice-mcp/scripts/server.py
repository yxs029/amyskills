#!/usr/bin/env python3
"""火山方舟 Agent Plan 语音 MCP Server (stdio)
工具:
  volc_tts(text, voice?, audio_format?, sample_rate?, output_path?) -> 合成音频,返回文件路径
  volc_asr(audio_path, language?) -> 语音转文字(豆包流式识别2.0 nostream)
鉴权: 从 ~/.hermes/.env 读 ark key (WEB_SEARCH_API_KEY 变量,与 VOLC_AGENTPLAN_KEY 同值)
运行: ~/litellm-deploy/venv/bin/python3 server.py  (需 mcp + websockets)
"""
import asyncio, base64, gzip, json, struct, subprocess, tempfile, urllib.request, uuid
from pathlib import Path

from mcp.server.fastmcp import FastMCP

ENV = Path.home() / '.hermes/.env'
CACHE_DIR = Path.home() / '.hermes/audio_cache'
TTS_URL = 'https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional'
ASR_WS = 'wss://openspeech.bytedance.com/api/v3/plan/sauc/bigmodel_nostream'
DEFAULT_VOICE = 'zh_female_vv_uranus_bigtts'


def _key() -> str:
    for l in ENV.read_text().splitlines():
        if l.startswith('WEB_SEARCH_API_KEY') and 'ark-' in l:
            return l.split('=', 1)[1].strip()
    raise RuntimeError('ark key not found in ~/.hermes/.env')


mcp = FastMCP('volc-voice')


@mcp.tool()
def volc_tts(text: str, voice: str = DEFAULT_VOICE,
             audio_format: str = 'mp3', sample_rate: int = 24000,
             output_path: str = '') -> str:
    """豆包语音合成2.0: 文本转音频文件。text建议<=500字(套餐按字符计费,约1350AFP/万字)。返回音频文件绝对路径。"""
    if not text.strip():
        return json.dumps({'success': False, 'error': 'text is empty'})
    payload = {'req_params': {'text': text, 'speaker': voice,
                              'audio_params': {'format': audio_format, 'sample_rate': sample_rate}}}
    req = urllib.request.Request(TTS_URL, method='POST',
        headers={'X-Api-Key': _key(), 'X-Api-Resource-Id': 'seed-tts-2.0',
                 'Content-Type': 'application/json',
                 'X-Control-Require-Usage-Tokens-Return': '*'},
        data=json.dumps(payload).encode())
    audio, usage = b'', '?'
    for line in urllib.request.urlopen(req, timeout=120).read().decode().splitlines():
        obj = json.loads(line)
        if obj.get('data'):
            audio += base64.b64decode(obj['data'])
        add = ((obj.get('result') or {}).get('additions') or {}) if isinstance(obj.get('result'), dict) else {}
        if add.get('usage_tokens'):
            usage = add['usage_tokens']
    out = Path(output_path) if output_path else CACHE_DIR / f"volc_tts_{uuid.uuid4().hex[:8]}.{audio_format}"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(audio)
    return json.dumps({'success': len(audio) > 0, 'path': str(out),
                       'bytes': len(audio), 'usage_tokens': usage}, ensure_ascii=False)


def _to_16k_pcm(src: Path) -> bytes:
    """任意音频 -> 16kHz/16bit/单声道 pcm_s16le (ASR 硬性要求)"""
    suffix = src.suffix.lower()
    if suffix == '.pcm':
        return src.read_bytes()
    out = tempfile.mktemp(suffix='.pcm')
    subprocess.run(['ffmpeg', '-y', '-i', str(src), '-ar', '16000', '-ac', '1',
                    '-acodec', 'pcm_s16le', '-f', 's16le', '-loglevel', 'error', out], check=True)
    data = Path(out).read_bytes()
    Path(out).unlink(missing_ok=True)
    return data


def _frame(mtype: int, flags: int, serial: int, comp: int) -> bytes:
    """火山语音二进制协议 4 字节头(大端): ver=1, hdrlen=1(4B)"""
    return bytes([0b0001_0001, (mtype << 4) | flags, (serial << 4) | comp, 0x00])


async def _asr_nostream(pcm: bytes, language: str = '') -> str:
    import websockets
    headers = {'X-Api-Key': _key(), 'X-Api-Resource-Id': 'volc.seedasr.sauc.duration',
               'X-Api-Request-Id': str(uuid.uuid4()), 'X-Api-Connect-Id': str(uuid.uuid4())}
    first = {'user': {'uid': 'hermes-mcp'},
             'audio': {'format': 'pcm', 'rate': 16000, 'bits': 16, 'channel': 1},
             'request': {'model_name': 'bigmodel', 'enable_punc': True, 'enable_itn': True}}
    if language:
        first['request']['language'] = language
    text = ''
    async with websockets.connect(ASR_WS, additional_headers=headers, max_size=10 * 1024 * 1024) as ws:
        body = gzip.compress(json.dumps(first).encode())
        await ws.send(_frame(0b0001, 0b0001, 0b0001, 0b0001)
                      + struct.pack('>i', 1) + struct.pack('>I', len(body)) + body)
        CH = 6400  # 200ms/包 @16kHz16bit
        chunks = [pcm[i:i + CH] for i in range(0, len(pcm), CH)]
        for i, ch in enumerate(chunks):
            seq, last = i + 2, (i == len(chunks) - 1)
            flags = 0b0011 if last else 0b0001
            if last:
                seq = -seq
            await ws.send(_frame(0b0010, flags, 0b0000, 0b0000)
                          + struct.pack('>i', seq) + struct.pack('>I', len(ch)) + ch)
            if not last:
                await asyncio.sleep(0.12)
        while True:
            resp = await asyncio.wait_for(ws.recv(), timeout=30)
            if isinstance(resp, str):
                continue
            mtype, flags, comp = (resp[1] >> 4) & 0x0f, resp[1] & 0x0f, resp[2] & 0x0f
            off = 4 + (4 if flags & 0b0001 else 0)
            size = struct.unpack('>I', resp[off:off + 4])[0]
            payload = resp[off + 4:off + 4 + size]
            if comp == 0b0001:
                payload = gzip.decompress(payload)
            if mtype == 0b1111:
                raise RuntimeError(f'ASR error frame: {payload[:200]}')
            obj = json.loads(payload)
            t = (obj.get('result') or {}).get('text', '')
            if t:
                text = t
            if (obj.get('result') or {}).get('utterances', [{}])[-1].get('definite') if (obj.get('result') or {}).get('utterances') else False:
                break
    return text


@mcp.tool()
def volc_asr(audio_path: str, language: str = '') -> str:
    """豆包流式语音识别2.0: 音频文件转文字。支持 wav/mp3/ogg/pcm(自动转16kHz)。language可指定如 zh-CN/en-US/ja-JP(留空=中英自动)。计费约450AFP/小时。"""
    src = Path(audio_path).expanduser()
    if not src.exists():
        return json.dumps({'success': False, 'error': f'file not found: {audio_path}'})
    if src.stat().st_size > 50 * 1024 * 1024:
        return json.dumps({'success': False, 'error': 'file too large (>50MB)'})
    pcm = _to_16k_pcm(src)
    if len(pcm) > 16000 * 2 * 300:
        return json.dumps({'success': False, 'error': 'audio longer than 300s, split first'})
    text = asyncio.run(_asr_nostream(pcm, language))
    return json.dumps({'success': True, 'text': text, 'duration_s': round(len(pcm) / 32000, 1)},
                      ensure_ascii=False)


if __name__ == '__main__':
    mcp.run()
