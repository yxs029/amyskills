#!/usr/bin/env python3
"""
verify_defects.py — 云效缺陷格式批量验证脚本

每次批量提单后运行本脚本，逐条GET已提交的缺陷，核对格式是否正确。
任何一条不通过都会列出失败项，ALL PASS才能交付给老大。

用法：
  python3 verify_defects.py                       # 验证全部12条默认列表
  python3 verify_defects.py <tc_id>:<wid> ...     # 验证指定的缺陷

依赖：仅用 requests（pip install requests）
"""

import os
import re
import sys
import json
import requests


def load_credentials():
    """从凭证文件读取token和org_id"""
    cred_path = os.path.expanduser("~/SRMPRO/文档库/03-R_数据层/yunxiao_id.md")
    if not os.path.exists(cred_path):
        print(f"❌ 凭证文件不存在: {cred_path}")
        sys.exit(1)

    with open(cred_path, "r", encoding="utf-8") as f:
        text = f.read()

    token = re.search(r"yunxiao_token\s*=\s*(\S+)", text)
    org_id = re.search(r"yunxiao_org_id\s*=\s*(\S+)", text)
    if not token or not org_id:
        print("❌ 凭证文件格式错误，找不到token或org_id")
        sys.exit(1)

    return token.group(1), org_id.group(1)


# SRMPRO项目默认12条缺陷（2026-07-08本轮测试）
DEFAULT_DEFECTS = [
    ("E2E-001", "feff5e5cd04219d9dda9ea8bec"),
    ("E2E-002", "cc2ac0b02e84d9c3d4ee360d14"),
    ("PERM-001", "08e6ab4c1e4a71c8b49187a0bc"),
    ("TC-REPORT-001", "561e96ab4792fc2aeeee11dfb8"),
    ("TC-TREE-003", "293f653bbf6be386287b55f1f3"),
    ("TC-TREE-005", "a36c8a5aeae62c3d4b59cab0f4"),
    ("SEARCH-001", "2708cf5fbf74239935f6c3a42c"),
    ("SEARCH-002", "1c9010acdc6549199d8356e199"),
    ("ITG-002", "6d5660d796669b9d08bfdac1ba"),
    ("ITG-006", "32bff21c84d8d14c64a326719d"),
    ("ITG-005", "62aa501c1da474fcad85a20688"),
    ("TC_STAT_001", "24ba731ccf6142e0e67d3ff72e"),
]

# 哪些缺陷有截图（仅对有截图的缺陷检查B6）
DEFECTS_WITH_SCREENSHOTS = {
    "E2E-001", "E2E-002", "PERM-001", "TC-REPORT-001", "SEARCH-001",
    "SEARCH-002", "ITG-002", "ITG-005", "ITG-006",
}

# 8段模板必含的关键词
REQUIRED_KEYWORDS = [
    "前置", "问题链接", "用户账号", "供应商账号",
    "步骤", "问题", "期望", "定位",
]


def verify_one(tc_id, workitem_id, token, org_id):
    """验证单条缺陷的格式"""
    base_url = "https://openapi-rdc.aliyuncs.com"
    url = f"{base_url}/oapi/v1/projex/organizations/{org_id}/workitems/{workitem_id}"

    headers = {
        "x-yunxiao-token": token,
        "Content-Type": "application/json",
    }

    resp = requests.get(url, headers=headers, timeout=30)
    if resp.status_code != 200:
        return False, [f"GET HTTP {resp.status_code}"], {}

    data = resp.json()
    desc = data.get("description", "")
    fmt = data.get("formatType", "")
    subject = data.get("subject", "")

    has_img_expected = tc_id in DEFECTS_WITH_SCREENSHOTS

    checks = {
        "A2_标题AI提单-开头": subject.startswith("AI提单-"),
        "B1_formatType=RICHTEXT": fmt == "RICHTEXT",
        "B2_双引号article开头": desc.startswith('<article class="4ever-article">'),
        "B3_前200字符无单引号": "'" not in desc[:200],
        "B4_前500字符无换行": "\n" not in desc[:500],
        "B5_有hr分隔": "<hr>" in desc,
        "B6_有img": ("<img" in desc) if has_img_expected else True,
        "B7_8段关键词全在": all(kw in desc for kw in REQUIRED_KEYWORDS),
    }

    failed = [k for k, v in checks.items() if not v]
    return len(failed) == 0, failed, checks


def verify_all(workitem_pairs, token, org_id):
    """批量验证所有缺陷"""
    print("=" * 70)
    print("🔍 云效缺陷格式批量验证")
    print("=" * 70)
    print()

    all_pass = True
    pass_count = 0
    fail_count = 0

    for tc_id, wid in workitem_pairs:
        ok, failed, _ = verify_one(tc_id, wid, token, org_id)
        if ok:
            print(f"  ✅ {tc_id:18s} — 全部通过")
            pass_count += 1
        else:
            print(f"  ❌ {tc_id:18s} — 失败项: {failed}")
            all_pass = False
            fail_count += 1

    print()
    print("=" * 70)
    if all_pass:
        print(f"✅ {pass_count}/{len(workitem_pairs)} 全部通过，可以交付给老大 🎉")
    else:
        print(f"❌ {pass_count}/{len(workitem_pairs)} 通过，{fail_count} 条需要修复")
        print("   → 运行修复脚本重新生成HTML并PUT更新")
    print("=" * 70)

    return all_pass


def parse_argv(workitem_pairs):
    """解析命令行参数，支持 tc_id:wid 格式"""
    args = sys.argv[1:]
    if not args:
        return workitem_pairs

    custom = []
    for arg in args:
        if ":" not in arg:
            print(f"⚠️ 参数格式错误: {arg}（应为 tc_id:wid）")
            continue
        tc_id, wid = arg.split(":", 1)
        custom.append((tc_id.strip(), wid.strip()))
    return custom if custom else workitem_pairs


def main():
    token, org_id = load_credentials()
    pairs = parse_argv(DEFAULT_DEFECTS)
    ok = verify_all(pairs, token, org_id)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
