#!/usr/bin/env python3
# image-edit.py — AutoGLM 图片编辑
# 用法: python image-edit.py "<image_url>" "<prompt>"

import sys
import json
import hashlib
import time
import urllib.request

APP_ID = "100003"
APP_KEY = "38d2391985e2369a5fb8227d8e6cd5e5"
URL = "https://autoglm-api.zhipuai.cn/agentdr/v1/assistant/skills/image-edit"
TOKEN_URL = "http://127.0.0.1:18432/get_token"

try:
    with urllib.request.urlopen(TOKEN_URL) as resp:
        token = resp.read().decode("utf-8").strip()
except Exception as e:
    print(f"ERROR: 无法从本地服务获取 token: {e}")
    sys.exit(1)

if not token:
    print("ERROR: 获取到的 token 为空。")
    sys.exit(1)

if not token.lower().startswith("bearer "):
    token = f"Bearer {token}"

if len(sys.argv) < 3:
    print('用法: python image-edit.py "<image_url>" "<prompt>"')
    sys.exit(1)

image_url = sys.argv[1].strip()
prompt = sys.argv[2].strip()

timestamp = str(int(time.time()))
sign_data = f"{APP_ID}&{timestamp}&{APP_KEY}"
sign = hashlib.md5(sign_data.encode("utf-8")).hexdigest()

payload = json.dumps({
    "prompt": prompt,
    "image_url": image_url,
}).encode("utf-8")

headers = {
    "Authorization": token,
    "Content-Type": "application/json",
    "X-Auth-Appid": APP_ID,
    "X-Auth-TimeStamp": timestamp,
    "X-Auth-Sign": sign,
}

req = urllib.request.Request(URL, data=payload, headers=headers, method="POST")
with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read().decode("utf-8"))
    print(json.dumps(result, ensure_ascii=False, indent=2))
