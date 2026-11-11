#!/usr/bin/env python3
"""
视频号 / 短视频批量处理流水线：解密（可选）→ 转写 → 结构化入库

支持两种输入：
  1) 已解密的 mp4/mp3 目录（本机工具已一键下载解密的情况）
  2) 加密 mp4 + manifest.json（含 decode_key）的目录

产出（每个视频一份）：
  out/{slug}/transcript.json   带时间戳分段
  out/{slug}/transcript.md     可读逐字稿（含时间戳锚点）
  out/index.csv                汇总索引，供后续拆解管道消费

manifest.json 格式（方式 2 需要）：
[
  {"file": "a.mp4", "decode_key": "2136343393", "title": "标题", "author": "作者",
   "publish_date": "2026-08-14", "url": "https://...", "stats": {"like": 45}}
]

用法：
  python3 batch_pipeline.py --in ./videos --out ./out
  python3 batch_pipeline.py --in ./videos --out ./out --manifest ./videos/manifest.json
"""
import argparse
import csv
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
MEDIA_EXT = {'.mp4', '.mp3', '.wav', '.m4a', '.webm', '.mov'}


def slugify(name, maxlen=60):
    s = re.sub(r'[^\w\u4e00-\u9fff-]+', '_', name).strip('_')
    return s[:maxlen] or 'item'


def decrypt(enc_path, decode_key, out_path):
    """调用 Node 脚本解密视频号视频"""
    script = HERE / 'wx_decrypt.js'
    if not script.exists():
        print('  跳过解密：缺少 wx_decrypt.js')
        return False
    r = subprocess.run(
        ['node', str(script), str(enc_path), str(decode_key), str(out_path)],
        capture_output=True, text=True, timeout=300)
    if r.returncode == 0:
        print('  解密成功')
        return True
    print('  解密失败: ' + (r.stderr or r.stdout).strip().splitlines()[-1:][0] if (r.stderr or r.stdout) else '  解密失败')
    return False


def transcribe(media_path, workdir):
    """调用 manus-speech-to-text 转写，返回 (segments, full_text)"""
    r = subprocess.run(['manus-speech-to-text', str(media_path)],
                       capture_output=True, text=True, timeout=1800, cwd=str(workdir))
    out = r.stdout + r.stderr
    m = re.search(r'JSON saved to (\S+\.json)', out)
    if not m:
        print('  转写失败')
        return None, None
    with open(m.group(1), encoding='utf-8') as f:
        d = json.load(f)
    return d.get('segments', []), d.get('full_text', '')


def fmt_ts(sec):
    try:
        sec = float(sec)
    except (TypeError, ValueError):
        return '00:00'
    return '%02d:%05.2f' % (int(sec // 60), sec % 60)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='indir', required=True)
    ap.add_argument('--out', dest='outdir', required=True)
    ap.add_argument('--manifest', default=None)
    args = ap.parse_args()

    indir, outdir = Path(args.indir), Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    meta_map = {}
    if args.manifest and Path(args.manifest).exists():
        with open(args.manifest, encoding='utf-8') as f:
            for it in json.load(f):
                meta_map[it['file']] = it

    files = sorted([p for p in indir.iterdir()
                    if p.is_file() and p.suffix.lower() in MEDIA_EXT])
    if not files:
        print('未找到媒体文件: ' + str(indir))
        sys.exit(1)

    rows = []
    for i, p in enumerate(files, 1):
        meta = meta_map.get(p.name, {})
        title = meta.get('title') or p.stem
        slug = '%03d_%s' % (i, slugify(title))
        d = outdir / slug
        d.mkdir(exist_ok=True)
        print('[%d/%d] %s' % (i, len(files), title))

        media = p
        if meta.get('decode_key'):
            dec = d / 'decrypted.mp4'
            if decrypt(p, meta['decode_key'], dec):
                media = dec
            else:
                continue

        segs, full = transcribe(media, d)
        if segs is None:
            continue

        with open(d / 'transcript.json', 'w', encoding='utf-8') as f:
            json.dump({'meta': meta, 'title': title,
                       'segments': segs, 'full_text': full},
                      f, ensure_ascii=False, indent=2)

        lines = ['# ' + title, '']
        for k in ('author', 'publish_date', 'url'):
            if meta.get(k):
                lines.append('- %s: %s' % (k, meta[k]))
        if meta.get('stats'):
            lines.append('- stats: ' + json.dumps(meta['stats'], ensure_ascii=False))
        lines += ['', '## 逐字稿', '']
        for s in segs:
            st, en = s.get('start'), s.get('end')
            lines.append('`[%s - %s]` %s' % (fmt_ts(st), fmt_ts(en), s.get('text', '').strip()))
            lines.append('')
        with open(d / 'transcript.md', 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines) + '\n')

        rows.append({
            'slug': slug,
            'title': title,
            'author': meta.get('author', ''),
            'publish_date': meta.get('publish_date', ''),
            'duration_sec': round(float(segs[-1].get('end', 0)), 1) if segs else 0,
            'char_count': len(full or ''),
            'source_file': p.name,
            'url': meta.get('url', ''),
            'transcript_md': str((d / 'transcript.md').relative_to(outdir)),
        })
        print('  完成，%d 字' % len(full or ''))

    if rows:
        with open(outdir / 'index.csv', 'w', newline='', encoding='utf-8-sig') as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        print('\n汇总: %s (%d 条)' % (outdir / 'index.csv', len(rows)))


if __name__ == '__main__':
    main()
