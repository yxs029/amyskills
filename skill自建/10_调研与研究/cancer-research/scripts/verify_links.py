"""批量验证 drugs.db 里所有医院网站链接是否可访问。
结果写回 regimen_hospitals 表（新增 link_status / link_checked_at 字段）。

状态：
- ok          : HTTP 2xx/3xx，页面有内容
- fail        : HTTP 4xx/5xx 或连接失败
- empty       : 返回 200 但内容极少（疑似空页面/ parked domain）
- unknown     : 没有 URL
"""
import sqlite3
import urllib.request
import urllib.error
import socket
import ssl
import re
from datetime import datetime

DB = r"C:\Users\AaronMY\.mavis\workspace\drugs.db"
TIMEOUT = 12

# 不验证 SSL 证书（很多医院官网证书有问题）
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

def check_url(url):
    """返回 (status, http_code, content_length, final_url, error)"""
    if not url:
        return ("unknown", 0, 0, url, "no url")
    # 补全 https://
    if not url.startswith("http"):
        url = "https://" + url
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA}, method="GET")
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as resp:
            code = resp.getcode()
            final_url = resp.geturl()
            body = resp.read(20000)  # 只读前 20KB 判断是否空页
            clen = len(body)
            # 提取 title
            title = ""
            try:
                text = body.decode("utf-8", errors="ignore")
                m = re.search(r"<title[^>]*>(.*?)</title>", text, re.I | re.S)
                if m:
                    title = m.group(1).strip()[:80]
            except Exception:
                pass
            if code >= 400:
                return ("fail", code, clen, final_url, title)
            if clen < 500:
                return ("empty", code, clen, final_url, title or "content too short")
            return ("ok", code, clen, final_url, title)
    except urllib.error.HTTPError as e:
        return ("fail", e.code, 0, url, str(e.reason))
    except urllib.error.URLError as e:
        return ("fail", 0, 0, url, str(e.reason))
    except socket.timeout:
        return ("fail", 0, 0, url, "timeout")
    except Exception as e:
        return ("fail", 0, 0, url, type(e).__name__ + ": " + str(e)[:80])

def main():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    # 确保字段存在
    for col, typ in [("link_status", "TEXT"), ("link_http_code", "INTEGER"),
                     ("link_content_len", "INTEGER"), ("link_final_url", "TEXT"),
                     ("link_title", "TEXT"), ("link_checked_at", "TEXT")]:
        try:
            cur.execute(f"ALTER TABLE regimen_hospitals ADD COLUMN {col} {typ}")
        except sqlite3.OperationalError:
            pass  # 字段已存在
    conn.commit()

    # 取所有不重复的 URL
    cur.execute("SELECT DISTINCT contact_website FROM regimen_hospitals WHERE contact_website IS NOT NULL AND contact_website != ''")
    urls = [row[0] for row in cur.fetchall()]
    print(f"共 {len(urls)} 个不重复网站需要验证\n")

    results = {}
    for i, url in enumerate(urls, 1):
        status, code, clen, final, title = check_url(url)
        results[url] = (status, code, clen, final, title)
        icon = {"ok": "✅", "fail": "❌", "empty": "⚠️", "unknown": "➖"}[status]
        print(f"  [{i:2d}/{len(urls)}] {icon} {status:6s} [{code}] {url}")
        if title:
            print(f"         title: {title[:60]}")
        if status != "ok" and title and status != "empty":
            print(f"         error: {title[:80]}")

    # 写回数据库
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for url, (status, code, clen, final, title) in results.items():
        cur.execute("""UPDATE regimen_hospitals
                          SET link_status=?, link_http_code=?, link_content_len=?,
                              link_final_url=?, link_title=?, link_checked_at=?
                        WHERE contact_website=?""",
                    (status, code, clen, final, title, now, url))
    conn.commit()

    # 汇总
    print("\n" + "=" * 60)
    print("验证汇总")
    print("=" * 60)
    from collections import Counter
    c = Counter(v[0] for v in results.values())
    for status in ["ok", "empty", "fail", "unknown"]:
        print(f"  {status:8s}: {c.get(status, 0)}")
    print(f"  合计     : {len(results)}")
    print(f"\n验证时间：{now}")

    conn.close()

if __name__ == "__main__":
    main()
