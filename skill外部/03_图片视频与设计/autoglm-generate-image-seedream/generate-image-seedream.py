#!/usr/bin/env python3
# generate-image-seedream.py — AutoGLM Seedream 文生图
# 用法: python generate-image-seedream.py "图片描述文字"

import sys
import json
import hashlib
import time
import urllib.request
import urllib.error

APP_ID = "100003"
APP_KEY = "38d2391985e2369a5fb8227d8e6cd5e5"
URL = "https://autoglm-api.zhipuai.cn/agentdr/v1/assistant/skills/generate-image-seedream"
TOKEN_URL = "http://127.0.0.1:18432/get_token"


def get_token():
    try:
        with urllib.request.urlopen(TOKEN_URL) as resp:
            token = resp.read().decode("utf-8").strip()
    except Exception as exc:
        print(f"ERROR: 无法从本地服务获取 token: {exc}")
        sys.exit(1)

    if not token:
        print("ERROR: 获取到的 token 为空。")
        sys.exit(1)

    if not token.lower().startswith("bearer "):
        token = f"Bearer {token}"
    return token


def build_headers(token):
    timestamp = str(int(time.time()))
    sign_data = f"{APP_ID}&{timestamp}&{APP_KEY}"
    sign = hashlib.md5(sign_data.encode("utf-8")).hexdigest()
    return {
        "Authorization": token,
        "Content-Type": "application/json",
        "X-Auth-Appid": APP_ID,
        "X-Auth-TimeStamp": timestamp,
        "X-Auth-Sign": sign,
    }


def main():
    if len(sys.argv) < 2:
        print('用法: python generate-image-seedream.py "图片描述文字"')
        sys.exit(1)

    query = sys.argv[1]
    token = get_token()
    headers = build_headers(token)
    payload = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(URL, data=payload, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(f"ERROR: 请求失败，HTTP {exc.code}")
        print(body)
        sys.exit(1)
    except Exception as exc:
        print(f"ERROR: 请求失败: {exc}")
        sys.exit(1)

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
