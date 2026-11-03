#!/usr/bin/env python3
"""Probe LLM token plan - one tiny call to see if 429 still happens."""
import os
import sys

os.environ.setdefault("REQUESTS_CA_BUNDLE", r"C:\Users\AaronMY\AppData\Roaming\MiniMax\system-ca-certs.pem")
os.environ.setdefault("SSL_CERT_FILE", r"C:\Users\AaronMY\AppData\Roaming\MiniMax\system-ca-certs.pem")
os.environ.setdefault("HTTPS_PROXY", "http://127.0.0.1:7892")
os.environ.setdefault("HTTP_PROXY", "http://127.0.0.1:7892")
os.environ.setdefault("NO_PROXY", "localhost,127.0.0.1,::1")

sys.path.insert(0, r"C:\Users\AaronMY\.minimax\skills\arxiv-obsidian-collector\scripts")
from scorer import make_minimax_client

client = make_minimax_client(api_base="https://api.minimaxi.com/anthropic", api_key_env="MINIMAX_M3_API_KEY")
print(f"key prefix: {client.api_key[:12] if client.api_key else 'EMPTY'}")

try:
    resp = client.messages.create(
        model="m3",
        max_tokens=15,
        messages=[{"role": "user", "content": "回复 OK"}],
    )
    text = resp.content[0].text if resp.content else "no content"
    print(f"PROBE_OK: {text[:80]}")
except Exception as e:
    msg = str(e)[:300]
    print(f"PROBE_FAIL: {type(e).__name__}: {msg}")
