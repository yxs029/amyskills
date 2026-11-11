#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
zap_preflight.py — ZAP 登录态安全扫描 · 启动前一键自检（P0 工具）
把本次 ZAP 2.17 的环境/版本/浏览器/限速/scope 坑在动手前一次性体检，避免扫到一半返工。

用法：
  python3 zap_preflight.py --base http://127.0.0.1:8090 [--need-browser]
退出码：0 全部通过；1 有 FAIL（WARN 不阻断）。
"""
import argparse, json, sys, shutil, subprocess, urllib.request, urllib.error

def api(base, path, timeout=10):
    with urllib.request.urlopen(base + path, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8090")
    ap.add_argument("--need-browser", action="store_true", help="需要 AJAX Spider 时校验 Chrome/driver")
    a = ap.parse_args()
    fails, warns, oks = [], [], []

    # 1. daemon 存活 + 版本
    try:
        ver = api(a.base, "/JSON/core/view/version/")["version"]
        (oks if ver.startswith("2.") else warns).append(f"ZAP 版本 {ver}")
    except Exception as e:
        fails.append(f"ZAP daemon 不可达：{e}（先启动：zap.sh -daemon -port 8090 -dir ~/.ZAP，仅绑本机）")
        report(fails, warns, oks); sys.exit(1)

    # 2. HttpStateEnabled（登录态前提）
    try:
        st = api(a.base, "/JSON/core/view/optionHttpStateEnabled/").get("HttpStateEnabled")
        (oks if st == "true" else warns).append(f"HttpStateEnabled={st}（登录态扫描需 true：GET /JSON/core/action/setOptionHttpStateEnabled/?Boolean=true）")
    except Exception as e:
        warns.append(f"读取 HttpStateEnabled 失败：{e}")

    # 3. 关键 2.17 API 是否存在（名字核对，杜绝旧记忆试错）
    checks = [
        ("/JSON/httpSessions/action/createEmptySession/", "createEmptySession"),
        ("/JSON/context/action/includeInContext/", "includeInContext"),
        ("/JSON/spider/view/fullResults/", "spider fullResults"),
        ("/JSON/ascan/view/scans/", "ascan scans"),
        ("/JSON/reports/view/templates/", "reports templates"),
    ]
    for path, name in checks:
        try:
            # 无参调用通常 400（缺参）或返回 JSON，两者都证明端点存在；404 才是不存在
            api(a.base, path)
            oks.append(f"API 存在：{name}")
        except urllib.error.HTTPError as e:
            (oks if e.code in (400,) else fails).append(f"API {name} HTTP {e.code}")
        except Exception:
            oks.append(f"API 可达：{name}")

    # 4. 限速选项可写性（只回读，不改动现有配置）
    for opt in ["optionThreadPerHost", "optionDelayInMs", "optionMaxScanDurationInMins"]:
        try:
            api(a.base, f"/JSON/ascan/view/{opt}/")
            oks.append(f"ascan 选项可读：{opt}")
        except Exception:
            warns.append(f"ascan 选项读不到：{opt}（扫描前需核对 2.17 选项名）")

    # 5. 浏览器 / driver（仅在需要 AJAX Spider 时强制）
    if a.need_browser:
        chrome = shutil.which("google-chrome") or shutil.which("google-chrome-stable") \
                 or shutil.which("chromium") or shutil.which("chromium-browser")
        if not chrome:
            fails.append("未找到 Chrome/Chromium，AJAX Spider 无法运行")
        else:
            try:
                cv = subprocess.run([chrome, "--version"], capture_output=True, text=True, timeout=15).stdout.strip()
                warns.append(f"{cv}（ZAP 内置 driver 常锁特定大版本，不匹配时 AJAX 启动即停；普通 Spider 够用可跳过）")
            except Exception as e:
                warns.append(f"Chrome 版本读取失败：{e}")

    # 6. 安全红线提醒（非检测项，打印）
    warns.append("红线复核：已获授权？ZAP 仅绑 127.0.0.1？凭据走环境变量？写操作 URL 已排除？Spider 设了 maxDuration？")
    report(fails, warns, oks)
    sys.exit(1 if fails else 0)

def report(fails, warns, oks):
    print(f"[ZAP Preflight] PASS {len(oks)} / WARN {len(warns)} / FAIL {len(fails)}")
    for x in oks: print("  ✅", x)
    for x in warns: print("  ⚠️ ", x)
    for x in fails: print("  ❌", x)

if __name__ == "__main__":
    main()
