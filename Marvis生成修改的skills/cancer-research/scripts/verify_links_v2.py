"""用 requests + 宽松 SSL 重新验证（很多医院官网用旧版 TLS）。"""
import sys
import sqlite3
import requests
import re
from datetime import datetime
import urllib3

# 强制 stdout UTF-8（防 GBK 报错，checklist 已闭环 2026-08-28）
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

DB = r"C:\Users\AaronMY\.mavis\workspace\drugs.db"
TIMEOUT = 15
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

# 自定义 adapter 允许旧版 TLS
from requests.adapters import HTTPAdapter
from urllib3.util.ssl_ import create_urllib3_context
import ssl

class LegacySSLAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        ctx = create_urllib3_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        ctx.set_ciphers("DEFAULT@SECLEVEL=1")
        ctx.options |= 0x4  # OP_LEGACY_SERVER_CONNECT
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)

session = requests.Session()
session.mount("https://", LegacySSLAdapter())
session.headers.update({"User-Agent": UA})

def check_url(url):
    if not url:
        return ("unknown", 0, 0, url, "no url")
    if not url.startswith("http"):
        url = "https://" + url
    try:
        r = session.get(url, timeout=TIMEOUT, verify=False, allow_redirects=True)
        code = r.status_code
        final = r.url
        clen = len(r.content)
        title = ""
        try:
            text = r.text[:20000]
            m = re.search(r"<title[^>]*>(.*?)</title>", text, re.I | re.S)
            if m:
                title = m.group(1).strip()[:80]
        except Exception:
            pass
        if code >= 400:
            return ("fail", code, clen, final, title or f"HTTP {code}")
        if clen < 500:
            return ("empty", code, clen, final, title or "content too short")
        return ("ok", code, clen, final, title)
    except requests.exceptions.SSLError as e:
        # SSL 失败，试 http
        if url.startswith("https://"):
            http_url = "http://" + url[8:]
            try:
                r = session.get(http_url, timeout=TIMEOUT, verify=False, allow_redirects=True)
                code = r.status_code
                final = r.url
                clen = len(r.content)
                title = ""
                try:
                    text = r.text[:20000]
                    m = re.search(r"<title[^>]*>(.*?)</title>", text, re.I | re.S)
                    if m: title = m.group(1).strip()[:80]
                except Exception: pass
                if code < 400 and clen >= 500:
                    return ("ok", code, clen, final, title + " [via http]")
                return ("fail", code, clen, final, title or "http also failed")
            except Exception as e2:
                return ("fail", 0, 0, url, f"SSL+HTTP both failed: {type(e2).__name__}")
        return ("fail", 0, 0, url, f"SSL: {type(e).__name__}")
    except requests.exceptions.ConnectionError as e:
        return ("fail", 0, 0, url, f"Connection: {type(e).__name__}")
    except requests.exceptions.Timeout:
        return ("fail", 0, 0, url, "timeout")
    except Exception as e:
        return ("fail", 0, 0, url, f"{type(e).__name__}: {str(e)[:80]}")

def main():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    cur.execute("SELECT DISTINCT contact_website FROM regimen_hospitals WHERE contact_website IS NOT NULL AND contact_website != ''")
    urls = [row[0] for row in cur.fetchall()]
    print(f"共 {len(urls)} 个网站需要验证（requests + 宽松 SSL，并行 8 线程）\n", flush=True)

    # checklist #3: 改用 ThreadPoolExecutor 并行验证（8 线程，~30 URL × 15s 单线 ~7.5min → 并行 ~1min）
    from concurrent.futures import ThreadPoolExecutor, as_completed
    results = {}
    done = 0
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(check_url, url): url for url in urls}
        for fut in as_completed(futures):
            url = futures[fut]
            try:
                status, code, clen, final, title = fut.result()
            except Exception as e:
                status, code, clen, final, title = ("fail", 0, 0, url, f"executor error: {type(e).__name__}")
            results[url] = (status, code, clen, final, title)
            done += 1
            icon = {"ok": "✅", "fail": "❌", "empty": "⚠️", "unknown": "➖"}[status]
            # 按 url 完成顺序打印，但显示 [i/N] 进度
            print(f"  [{done:2d}/{len(urls)}] {icon} {status:6s} [{code}] {url}", flush=True)
            if title:
                print(f"         → {title[:70]}", flush=True)

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for url, (status, code, clen, final, title) in results.items():
        cur.execute("""UPDATE regimen_hospitals
                          SET link_status=?, link_http_code=?, link_content_len=?,
                              link_final_url=?, link_title=?, link_checked_at=?
                        WHERE contact_website=?""",
                    (status, code, clen, final, title, now, url))
    conn.commit()

    from collections import Counter
    c = Counter(v[0] for v in results.values())
    print("\n" + "=" * 60, flush=True)
    print("验证汇总（requests 宽松 SSL · 8 线程并行）", flush=True)
    print("=" * 60, flush=True)
    for s in ["ok", "empty", "fail"]:
        print(f"  {s:8s}: {c.get(s, 0)}", flush=True)
    print(f"  合计     : {len(results)}", flush=True)

    conn.close()

if __name__ == "__main__":
    main()
