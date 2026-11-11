"""修正已知错误的医院官网 URL，然后重新验证。"""
import sqlite3, requests, re, ssl, urllib3
from datetime import datetime
urllib3.disable_warnings()
from requests.adapters import HTTPAdapter
from urllib3.util.ssl_ import create_urllib3_context

DB = r"C:\Users\AaronMY\.mavis\workspace\drugs.db"

class LegacyAdapter(HTTPAdapter):
    def init_poolmanager(self, *a, **kw):
        ctx = create_urllib3_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        ctx.set_ciphers("DEFAULT@SECLEVEL=1")
        ctx.options |= 0x4
        kw["ssl_context"] = ctx
        return super().init_poolmanager(*a, **kw)

s = requests.Session()
s.mount("https://", LegacyAdapter())
s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0"})

# 已知正确的 URL 修正（旧 URL → 新 URL）
URL_FIXES = {
    "zjch.cn": "www.zjcc.org.cn",           # 浙江省肿瘤医院
    "gamhospitaly.cn": "www.gamhospital.ac.cn",  # 广安门医院
    "longhua.net": "www.longhua.net",       # 龙华医院
    "gdhtcm.com": "www.gdhtcm.com",         # 广东省中医院
    "jshtcm.com": "www.jshtcm.com",         # 江苏省中医院
    "cicams.ac.cn": "www.cicams.ac.cn",     # 医科院肿瘤
    "taihehospital.com": "www.taihehospital.com",  # 十堰太和
    "haicimedical.com": "www.haicimedical.com",    # 海慈
    "ehbh.cn": "www.ehbh.cn",               # 东方肝胆
    "gzucm.edu.cn": "www.gzucm.edu.cn",     # 贵州中医药大学
    "chhospital.com.cn": "www.chhospital.com.cn",  # 长海医院
    "bjhzy.cn": "www.bjhzy.cn",             # 北京好中医
    "hnzyy.cn": "www.hnzyy.cn",             # 湖南中医药大学一附院
    "bucmsdsf.com": "www.dsfy.cn",          # 北中医三附院
    "pkucancer.cn": "www.bjcancer.org",     # 北京大学肿瘤医院（备用域名）
    "fudan-zl.org": "www.shca.org.cn",      # 复旦肿瘤（上海市癌症中心）
}

conn = sqlite3.connect(DB)
cur = conn.cursor()

for old, new in URL_FIXES.items():
    cur.execute("UPDATE regimen_hospitals SET contact_website=? WHERE contact_website=?", (new, old))
    print(f"  修正: {old} → {new}")
conn.commit()

# 重新验证
cur.execute("SELECT DISTINCT contact_website FROM regimen_hospitals WHERE contact_website IS NOT NULL AND contact_website != ''")
urls = [r[0] for r in cur.fetchall()]

def check(url):
    if not url.startswith("http"):
        url = "https://" + url
    try:
        r = s.get(url, timeout=15, verify=False, allow_redirects=True)
        clen = len(r.content)
        title = ""
        try:
            m = re.search(r"<title[^>]*>(.*?)</title>", r.text[:20000], re.I|re.S)
            if m: title = m.group(1).strip()[:80]
        except: pass
        if r.status_code >= 400:
            # 试 http
            if url.startswith("https://"):
                r2 = s.get("http://"+url[8:], timeout=15, verify=False, allow_redirects=True)
                if r2.status_code < 400 and len(r2.content) >= 500:
                    m = re.search(r"<title[^>]*>(.*?)</title>", r2.text[:20000], re.I|re.S)
                    t = m.group(1).strip()[:80] if m else ""
                    return ("ok", r2.status_code, len(r2.content), r2.url, t + " [http]")
            return ("fail", r.status_code, clen, r.url, title or f"HTTP {r.status_code}")
        if clen < 500:
            return ("empty", r.status_code, clen, r.url, title or "too short")
        return ("ok", r.status_code, clen, r.url, title)
    except Exception as e:
        # 试 http
        if url.startswith("https://"):
            try:
                r2 = s.get("http://"+url[8:], timeout=15, verify=False, allow_redirects=True)
                if r2.status_code < 400 and len(r2.content) >= 500:
                    m = re.search(r"<title[^>]*>(.*?)</title>", r2.text[:20000], re.I|re.S)
                    t = m.group(1).strip()[:80] if m else ""
                    return ("ok", r2.status_code, len(r2.content), r2.url, t + " [http]")
            except: pass
        return ("fail", 0, 0, url, type(e).__name__)

print(f"\n重新验证 {len(urls)} 个 URL...\n")
results = {}
for i, url in enumerate(urls, 1):
    st, code, clen, final, title = check(url)
    results[url] = (st, code, clen, final, title)
    icon = {"ok":"✅","fail":"❌","empty":"⚠️"}[st]
    print(f"  [{i:2d}/{len(urls)}] {icon} {st:6s} [{code}] {url}")
    if title: print(f"         → {title[:70]}")

now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
for url, (st, code, clen, final, title) in results.items():
    cur.execute("""UPDATE regimen_hospitals SET link_status=?,link_http_code=?,link_content_len=?,link_final_url=?,link_title=?,link_checked_at=? WHERE contact_website=?""",
        (st, code, clen, final, title, now, url))
conn.commit()

from collections import Counter
c = Counter(v[0] for v in results.values())
print(f"\n汇总: ✅ {c.get('ok',0)}  ❌ {c.get('fail',0)}  ⚠️ {c.get('empty',0)}")
conn.close()
