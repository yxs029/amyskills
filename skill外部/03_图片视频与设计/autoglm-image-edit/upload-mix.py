#!/usr/bin/env python3
# upload_mix.py — AutoGLM Upload Mix
# 用法: python upload_mix.py "<本地文件路径>"

import sys
import json
import hashlib
import time
import urllib.request
import os
import mimetypes
import uuid

APP_ID = "100003"
APP_KEY = "38d2391985e2369a5fb8227d8e6cd5e5"
URL = "https://autoglm-api.zhipuai.cn/agentdr/v1/assistant/upload-mix"
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

if len(sys.argv) < 2:
    print('用法: python upload-mix.py "<本地文件路径>"')
    sys.exit(1)

file_path = sys.argv[1]
if not os.path.isfile(file_path):
    print(f"ERROR: 文件不存在: {file_path}")
    sys.exit(1)

filename = os.path.basename(file_path)
mime_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"

with open(file_path, "rb") as f:
    file_data = f.read()

timestamp = str(int(time.time()))
sign_data = f"{APP_ID}&{timestamp}&{APP_KEY}"
sign = hashlib.md5(sign_data.encode("utf-8")).hexdigest()

boundary = f"----WebKitFormBoundary{uuid.uuid4().hex[:16]}"

body = (
    f"--{boundary}\r\n"
    f"Content-Disposition: form-data; name=\"files\"; filename=\"{filename}\"\r\n"
    f"Content-Type: {mime_type}\r\n"
    f"\r\n"
).encode("utf-8") + file_data + f"\r\n--{boundary}--\r\n".encode("utf-8")

headers = {
    "Authorization": token,
    "Content-Type": f"multipart/form-data; boundary={boundary}",
    "X-Auth-Appid": APP_ID,
    "X-Auth-TimeStamp": timestamp,
    "X-Auth-Sign": sign,
}

req = urllib.request.Request(URL, data=body, headers=headers, method="POST")
with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read().decode("utf-8"))
    print(json.dumps(result, ensure_ascii=False, indent=2))
