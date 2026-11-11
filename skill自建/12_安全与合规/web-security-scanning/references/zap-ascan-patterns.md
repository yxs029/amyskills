# Active Scan Patterns & Rate Limiting

## URL template deduplication (for MRO/catalog sites)

When a spider discovers 1,000+ product pages (e.g. `/mro/list/673`, `/mro/list/684`), do NOT scan each one — active scan attacks each URL with 50+ payloads, which wastes time AND triggers WAF.

### Template deduplication algorithm

```python
def template(u):
    p = urllib.parse.urlsplit(u)
    out = []
    for seg in p.path.split("/"):
        if not seg: continue
        if seg.isdigit(): out.append("{id}")
        elif re.fullmatch(r"[0-9a-fA-F]{8,}", seg): out.append("{hex}")
        elif re.fullmatch(r"[A-Za-z0-9_-]{12,}", seg): out.append("{slug}")
        else: out.append(seg)
    qkeys = tuple(sorted(k for k, _ in urllib.parse.parse_qsl(p.query)))
    return "/" + "/".join(out), qkeys
```

### Group by (controller, template, query_keys) — keep 1-3 representatives per group

### Functional pages — always scan all （no dedup）
- `/account/`, `/cart`, `/order/list`, `/quote`, `/upload/`, `/service/help`, `/about`, `/signin`
- Parametric search: `/parametric`, `/list`, `/search`
- `/robots.txt`, `/sitemap.xml`

### Catalog controllers to sample
```
mro, part, partIntelligence, connectors, resistors, rf-microwave, transistors, 
transformers, diodes, oscillators, converters, amplifier-circuits, trigger-devices,
sensors-transducers, logic, signal-circuits, capacitors, consumer-circuits,
programmable-logic, power-circuits, optoelectronics, filters, search, batteries,
circuit-protection, connector-support, crystals-resonators, drivers-interfaces,
inductors, memory, microcontrollers-and-processors, rc-networks, relays, sockets,
telecommunication
```

### Sensitive URL exclusions （must be excluded from both context and proxy）
```
logout|signout|loginout|requestPassword|resetPassword|account/password|
account/.*(delete|remove)|order/.*(cancel|delete|confirm|pay)|
cart/.*(delete|remove|checkout)|pay/.*|payment/.*|
sms.*|sendCode.*|validcode.*|captcha.*|register.*|signup.*
```

## 主动扫描限速配置 (ZAP 2.17)

```python
settings = [
    ("/JSON/ascan/action/setOptionThreadPerHost/", {"Integer": "3"}),
    ("/JSON/ascan/action/setOptionDelayInMs/", {"Integer": "50"}),
    ("/JSON/ascan/action/setOptionMaxRuleDurationInMins/", {"Integer": "5"}),
    ("/JSON/ascan/action/setOptionMaxScanDurationInMins/", {"Integer": "90"}),
    ("/JSON/ascan/action/setOptionMaxAlertsPerRule/", {"Integer": "0"}),  # 0 = unlimited
    ("/JSON/ascan/action/setOptionHandleAntiCSRFTokens/", {"Boolean": "true"}),
    ("/JSON/ascan/action/setOptionAddQueryParam/", {"Boolean": "false"}),
]
```

All use GET method. Option 参数名与类型匹配（Integer / Boolean / String）。

## Active scan start

```python
params = {
    "url": "https://www.example.com/",
    "contextId": "4",        # dedicated context with 250+ include regexes
    "recurse": "true",
    "inScopeOnly": "true",
    "scanPolicyName": "Default Policy",
    "method": "",
    "postData": ""
}
# POST version
req = urllib.request.Request(base + "/JSON/ascan/action/scan/", data=urllib.parse.urlencode(params).encode())
```

## 轻量级监控（avoid full alert pull which hangs on 16000+ instances）

```python
import json, time, urllib.request
ZAP = "http://127.0.0.1:8090"
def scan():
    with urllib.request.urlopen(ZAP + "/JSON/ascan/view/scans/", timeout=20) as r:
        data = json.loads(r.read().decode())
    return next((x for x in data.get("scans", []) if x.get("id") == "0"), {})
last = None
while True:
    s = scan()
    line = f"{s.get('state')} {s.get('progress')}% req={s.get('reqCount')} newAlerts={s.get('newAlertCount')}"
    if line != last: print(line, flush=True); last = line
    if s.get("state") in ("FINISHED","STOPPED","PAUSED",""): break
    time.sleep(30)
```

## 未登录授权验证

For each sensitive path, send a clean-session GET (no proxy, no cookies) and check for redirect to `/signin`:

```python
s = requests.Session()
s.trust_env = False
r = s.get("https://target.com/account/", verify=False, allow_redirects=False)
assert r.status_code == 302
assert "/signin" in (r.headers.get("Location") or "")
```

## Results / reports

- ZAP alertCountsByRisk via `GET /JSON/alert/view/alertCountsByRisk/?baseurl=https://target.com`
- Alerts summary via `GET /JSON/alert/view/alertsSummary/?baseurl=https://target.com`
- Full alerts: `GET /JSON/alert/view/alerts/?baseurl=https://target.com&start=0&count=1000`
- Report generation: `POST /JSON/reports/action/generate/?title=report&template=traditional-html&sites=https://target.com&reportDir=/tmp/&reportFileName=report`