#!/usr/bin/env python3
"""
视频号「链接 → 逐字稿」全自动管道（需第三方解析 API 的 token）

解决的问题：视频号的加密视频地址与 decode_key 只由微信客户端下发，
沙盒无法直接获取。第三方解析服务已代为完成这一步，提供 REST 接口。
本脚本调用该接口取得 (加密URL, decode_key)，随后自动下载、解密、转写。

支持两家服务（二选一，取决于你手里的 token）：
  TikHub     : https://api.tikhub.io       环境变量 TIKHUB_API_KEY
  JustOneAPI : https://api.justoneapi.com  环境变量 JUSTONEAPI_TOKEN

用法：
  export TIKHUB_API_KEY=xxx
  python3 fetch_via_api.py https://weixin.qq.com/sph/A5hQDYgski --out ./out

  # 或
  export JUSTONEAPI_TOKEN=xxx
  python3 fetch_via_api.py https://weixin.qq.com/sph/A5hQDYgski --out ./out --provider justoneapi

注意：每次请求返回的 url 与 decode_key 必须成对使用，不可跨请求混用。
"""
import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
TIMEOUT = 120


def fetch_tikhub(share_url, key):
    """TikHub: wechat_channels/v2/fetch_video_detail"""
    r = requests.post(
        'https://api.tikhub.io/api/v1/wechat_channels/v2/fetch_video_detail',
        headers={'Authorization': 'Bearer ' + key,
                 'Content-Type': 'application/json'},
        json={'share_url': share_url, 'raw': False},
        timeout=TIMEOUT)
    r.raise_for_status()
    d = r.json()
    data = d.get('data') or {}
    media = data.get('media') or {}
    if isinstance(media, list):
        media = media[0] if media else {}
    url = media.get('full_url') or media.get('url')
    if media.get('url') and media.get('url_token') and not media.get('full_url'):
        url = media['url'] + media['url_token']
    return {
        'url': url,
        'decode_key': media.get('decode_key'),
        'title': data.get('title') or data.get('description') or '',
        'meta': {
            'object_id': data.get('id'),
            'nickname': data.get('nickname'),
            'create_time': data.get('create_time'),
            'like_count': data.get('like_count'),
            'fav_count': data.get('fav_count'),
            'forward_count': data.get('forward_count'),
            'comment_count': data.get('comment_count'),
            'duration': media.get('duration'),
            'resolution': '%sx%s' % (media.get('width'), media.get('height')),
            'md5': media.get('md5'),
        },
        'raw': d,
    }


def fetch_justoneapi(share_url, token):
    """JustOneAPI: 先用 feedInfo 解析 objectId，再取下载地址"""
    b = requests.get(
        'https://api.justoneapi.com/api/weixin-channels/get-video-basic-info/v1',
        params={'token': token, 'feedInfo': share_url}, timeout=TIMEOUT)
    b.raise_for_status()
    bj = b.json()
    if bj.get('code') != 0:
        raise RuntimeError('basic-info 失败: %s' % bj)
    data = bj.get('data') or {}
    object_id = data.get('objectId') or data.get('object_id')
    nonce = data.get('objectNonceId') or data.get('object_nonce_id') or ''
    if not object_id:
        raise RuntimeError('未取到 objectId: %s' % bj)

    d = requests.get(
        'https://api.justoneapi.com/api/weixin-channels/get-video-download-url/v1',
        params={'token': token, 'objectId': object_id, 'objectNonceId': nonce},
        timeout=TIMEOUT)
    d.raise_for_status()
    dj = d.json()
    if dj.get('code') != 0:
        raise RuntimeError('download-url 失败: %s' % dj)
    dd = dj.get('data') or {}
    media = dd.get('media') or dd
    if isinstance(media, list):
        media = media[0] if media else {}
    url = media.get('url') or ''
    if media.get('urlToken'):
        url += media['urlToken']
    return {
        'url': url,
        'decode_key': media.get('decodeKey') or media.get('decode_key'),
        'title': data.get('description') or data.get('title') or '',
        'meta': {'object_id': object_id},
        'raw': {'basic': bj, 'download': dj},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('share_url')
    ap.add_argument('--out', default='./out')
    ap.add_argument('--provider', choices=['tikhub', 'justoneapi'], default='tikhub')
    args = ap.parse_args()

    outdir = Path(args.out)
    outdir.mkdir(parents=True, exist_ok=True)

    if args.provider == 'tikhub':
        key = os.environ.get('TIKHUB_API_KEY')
        if not key:
            print('缺少环境变量 TIKHUB_API_KEY'); sys.exit(2)
        info = fetch_tikhub(args.share_url, key)
    else:
        key = os.environ.get('JUSTONEAPI_TOKEN')
        if not key:
            print('缺少环境变量 JUSTONEAPI_TOKEN'); sys.exit(2)
        info = fetch_justoneapi(args.share_url, key)

    with open(outdir / 'api_response.json', 'w', encoding='utf-8') as f:
        json.dump(info['raw'], f, ensure_ascii=False, indent=2)

    if not info['url'] or not info['decode_key']:
        print('接口未返回 url 或 decode_key，详见 api_response.json')
        sys.exit(3)

    print('标题      : ' + (info['title'] or '(无)'))
    print('decode_key: ' + str(info['decode_key']))

    enc = outdir / 'encrypted.mp4'
    print('下载中...')
    with requests.get(info['url'], stream=True, timeout=TIMEOUT) as r:
        r.raise_for_status()
        with open(enc, 'wb') as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    print('已下载 %s bytes' % f'{enc.stat().st_size:,}')

    dec = outdir / 'decrypted.mp4'
    rc = subprocess.run(
        ['node', str(HERE / 'wx_decrypt.js'), str(enc), str(info['decode_key']), str(dec)],
        capture_output=True, text=True, timeout=300)
    print(rc.stdout.strip())
    if rc.returncode != 0:
        print(rc.stderr.strip()); sys.exit(4)

    print('转写中...')
    t = subprocess.run(['manus-speech-to-text', str(dec)],
                       capture_output=True, text=True, timeout=1800, cwd=str(outdir))
    m = re.search(r'JSON saved to (\S+\.json)', t.stdout + t.stderr)
    if not m:
        print('转写失败'); sys.exit(5)
    with open(m.group(1), encoding='utf-8') as f:
        tr = json.load(f)

    segs = tr.get('segments', [])
    meta = info.get('meta') or {}
    lines = ['# ' + (info['title'] or '视频号内容'), '',
             '- 来源: ' + args.share_url]
    for k, label in [('nickname', '账号'), ('duration', '时长(秒)'),
                     ('resolution', '分辨率'), ('like_count', '点赞'),
                     ('fav_count', '收藏'), ('forward_count', '转发'),
                     ('comment_count', '评论'), ('object_id', 'object_id')]:
        if meta.get(k) is not None:
            lines.append('- %s: %s' % (label, meta[k]))
    lines += ['', '## 逐字稿', '']
    for s in segs:
        st, en = float(s.get('start', 0)), float(s.get('end', 0))
        lines.append('`[%02d:%05.2f - %02d:%05.2f]` %s' %
                     (st // 60, st % 60, en // 60, en % 60, s.get('text', '').strip()))
        lines.append('')
    with open(outdir / 'transcript.md', 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print('完成: %s（%d 字）' % (outdir / 'transcript.md', len(tr.get('full_text') or '')))


if __name__ == '__main__':
    main()
