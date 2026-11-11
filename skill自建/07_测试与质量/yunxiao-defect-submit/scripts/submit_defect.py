#!/usr/bin/env python3
"""
云效缺陷自动提单脚本
功能：从测试报告提取缺陷 → 按模板格式提交到云效
用法：
  单条提交: python3 submit_defect.py --defect defect.json
  批量提交: python3 submit_defect.py --batch defects.json
  更新缺陷: python3 submit_defect.py --update workitemId --title "新标题" --description "新描述"
"""

import requests
import json
import base64
import os
import re
import argparse
import time
import sys

# ============================================================
# 配置（SRMPRO项目固定参数）
# ============================================================
DOMAIN = "https://openapi-rdc.aliyuncs.com"
ORG_ID = "5f30dccc5fd102f22f6ba1c4"
SPACE_ID = "8fd106d2e9114df21947be9a14"
PROJECT_ID = "8fd106d2e9114df21947be9a14"
BUG_TYPE_ID = "37da3a07df4d08aef2e3b393"
ASSIGNED_TO_USER_ID = "5f30dcae42509b3c32f367e8"  # 袁雪松

# 凭证文件路径
CRED_FILE = os.path.expanduser("~/SRMPRO/文档库/03-R_数据层/yunxiao_id.md")

# P0/P1/P2 → 严重程度+优先级映射
SEVERITY_MAP = {
    "P0": ("5f4d4efe6250247696204dc6dd", "1-致命"),
    "P0_alt": ("39d1172d0a91194bdd785fa88b", "2-严重"),
    "P1": ("8dcb72afefd944c445e1a7ee8f", "3-一般"),
    "P2": ("5452c36be91ff150751335b6b6", "4-轻微"),
    "INFO": ("5452c36be91ff150751335b6b6", "4-轻微"),
}

PRIORITY_MAP = {
    "P0": ("c44dc2d43d2106e892d98cee47", "紧急"),
    "P0_alt": ("d215fd28f4ccf4e4ada063e92e", "高"),
    "P1": ("ea2dde53407a08c5815ab78748", "中"),
    "P2": ("0a73c6a9f04d34dd2d90f91926", "低"),
    "INFO": ("0a73c6a9f04d34dd2d90f91926", "低"),
}

# 默认选项值
DEFAULT_FUNCTION_CATEGORY = "供应商模块"
DEFAULT_ISSUE_TYPE = "功能错误（报错不符合设计）"
DEFAULT_ENVIRONMENT = "内测环境"


def load_credentials():
    """从凭证文件读取token"""
    if not os.path.exists(CRED_FILE):
        print(f"❌ 凭证文件不存在: {CRED_FILE}")
        sys.exit(1)

    with open(CRED_FILE, 'r') as f:
        content = f.read()

    token = org_id = space_id = None
    for line in content.splitlines():
        line = line.strip()
        if line.startswith('#') or not line:
            continue
        if '=' in line:
            key, _, value = line.partition('=')
            key = key.strip()
            value = value.strip()
            if 'token' in key.lower():
                token = value
            elif 'org' in key.lower() and 'id' in key.lower():
                org_id = value
            elif 'space' in key.lower() and 'id' in key.lower():
                space_id = value

    if not token:
        # 尝试用正则
        token_m = re.search(r'pt-[A-Za-z0-9_-]+', content)
        if token_m:
            token = token_m.group(0)

    if not token:
        print("❌ 无法从凭证文件中解析token")
        sys.exit(1)

    return token, org_id or ORG_ID, space_id or SPACE_ID


def get_headers(token):
    return {
        "Content-Type": "application/json",
        "x-yunxiao-token": token,
    }


def build_description(defect_data, screenshot_dir=None):
    """
    按老大指定的8段模板构建描述HTML
    defect_data 格式：
    {
        "precondition": "前置条件描述",
        "url": "问题链接",
        "user_account": "admin / Esic@2024",
        "supplier_account": "无",
        "steps": [
            {"action": "步骤动作", "result": "步骤结果", "screenshot": "截图文件名（可选）"}
        ],
        "problem_steps": [
            {"action": "问题步骤动作", "result": "实际异常结果", "screenshot": "截图文件名（可选）"}
        ],
        "expected": ["期望行为1", "期望行为2"],
        "root_cause": "定位分析",
        "screenshots": {"文件名": "路径"}
    }
    """
    html_parts = ['<article class="4ever-article">']

    # 1. 前置
    html_parts.append(f'<p><strong>前置：（什么条件下才会出现缺陷？）</strong></p>')
    html_parts.append(f'<p>{defect_data.get("precondition", "")}</p>')

    # 2. 问题链接 + 账号
    html_parts.append(f'<p>问题链接：{defect_data.get("url", "")}</p>')
    html_parts.append(f'<p>用户账号：{defect_data.get("user_account", "")}</p>')
    html_parts.append(f'<p>供应商账号：{defect_data.get("supplier_account", "无")}</p>')
    html_parts.append('<hr>')

    # 3. 步骤
    html_parts.append(f'<p><strong>步骤：（回想一下缺陷产生的操作步骤）</strong></p>')
    for i, step in enumerate(defect_data.get("steps", []), 1):
        action = step.get("action", "")
        result = step.get("result", "")
        html_parts.append(f'<p>{i}. {action} → {result}</p>')

        # 嵌入步骤截图
        screenshot = step.get("screenshot")
        if screenshot and screenshot_dir:
            img_path = os.path.join(screenshot_dir, screenshot)
            if os.path.exists(img_path):
                b64 = encode_image_b64(img_path)
                if b64:
                    html_parts.append(f'<p><img src="data:image/png;base64,{b64}" alt="{screenshot}" style="max-width:100%;border:1px solid #ddd;border-radius:4px"/></p>')

    # 4. 问题
    html_parts.append('<p>-</p>')
    html_parts.append(f'<p><strong>问题：（具体问题描述，可以放在步骤中）</strong></p>')
    for step in defect_data.get("problem_steps", []):
        action = step.get("action", "")
        result = step.get("result", "")
        html_parts.append(f'<p>{action} → {result}</p>')

        # 嵌入问题截图
        screenshot = step.get("screenshot")
        if screenshot and screenshot_dir:
            img_path = os.path.join(screenshot_dir, screenshot)
            if os.path.exists(img_path):
                b64 = encode_image_b64(img_path)
                if b64:
                    html_parts.append(f'<p><img src="data:image/png;base64,{b64}" alt="{screenshot}" style="max-width:100%;border:1px solid #ddd;border-radius:4px"/></p>')

    # 5. 期望
    html_parts.append('<p>-</p>')
    html_parts.append(f'<p><strong>期望：（正常功能是什么样的？）</strong></p>')
    for exp in defect_data.get("expected", []):
        html_parts.append(f'<p>{exp}</p>')

    # 6. 定位
    html_parts.append(f'<p><strong>定位：（推断出问题的原因是什么？）</strong></p>')
    html_parts.append(f'<p>{defect_data.get("root_cause", "")}</p>')

    html_parts.append('</article>')
    return ''.join(html_parts)


def encode_image_b64(image_path):
    """将图片文件转为base64"""
    try:
        with open(image_path, 'rb') as f:
            return base64.b64encode(f.read()).decode()
    except Exception as e:
        print(f"  ⚠️ 读取图片失败: {image_path}: {e}")
        return None


def build_title(defect_data):
    """
    构建标题：AI提单-{主模块}-{子模块}：{测试用例标题}，{操作结果}
    """
    prefix = "AI提单"
    main_module = defect_data.get("main_module", "文档库")
    sub_module = defect_data.get("sub_module", "")
    case_title = defect_data.get("case_title", "")
    result = defect_data.get("result_summary", "")

    title = f"{prefix}-{main_module}"
    if sub_module:
        title += f"-{sub_module}"
    title += f"：{case_title}"
    if result:
        title += f"，{result}"

    return title


def build_workitem_body(defect_data, screenshot_dir=None):
    """构建云效创建工作项请求体"""
    token, org_id, space_id = load_credentials()

    title = build_title(defect_data)
    description = build_description(defect_data, screenshot_dir)

    severity_key = defect_data.get("severity", "P1")
    severity_id, severity_name = SEVERITY_MAP.get(severity_key, SEVERITY_MAP["P1"])
    priority_id, priority_name = PRIORITY_MAP.get(severity_key, PRIORITY_MAP["P1"])

    body = {
        "subject": title,
        "description": description,
        "formatType": "MARKDOWN",
        "spaceId": space_id,
        "spaceIdentifier": space_id,
        "spaceType": "Project",
        "workitemTypeId": BUG_TYPE_ID,
        "assignedTo": ASSIGNED_TO_USER_ID,
        "customFieldValues": {
            "11a84d02dfe22457200ccee776": defect_data.get("function_category", DEFAULT_FUNCTION_CATEGORY),
            "seriousLevel": severity_id,
            "priority": priority_id,
            "0886f9621f999f923838979136": defect_data.get("issue_type", DEFAULT_ISSUE_TYPE),
            "dcc3ef7a2b06518658e170bc10": defect_data.get("environment", DEFAULT_ENVIRONMENT),
            "564b87a47ec3cc38200eb22606": defect_data.get("root_cause", ""),
        }
    }

    return body


def create_defect(defect_data, screenshot_dir=None, dry_run=False):
    """创建单条缺陷"""
    token, org_id, space_id = load_credentials()
    headers = get_headers(token)

    body = build_workitem_body(defect_data, screenshot_dir)

    if dry_run:
        print(f"\n📋 [DRY RUN] 标题: {body['subject']}")
        print(f"   描述长度: {len(body['description'])} 字符")
        return {"id": "dry-run", "subject": body["subject"]}

    url = f"{DOMAIN}/oapi/v1/projex/organizations/{org_id}/workitems"
    resp = requests.post(url, headers=headers, json=body, timeout=30)

    if resp.status_code == 200:
        data = resp.json()
        workitem_id = data.get("id", "")
        print(f"  ✅ 创建成功! ID={workitem_id}")
        return data
    else:
        print(f"  ❌ 创建失败 HTTP {resp.status_code}")
        try:
            err = resp.json()
            print(f"     {err.get('errorMessage', resp.text[:300])}")
        except:
            print(f"     {resp.text[:300]}")
        return None


def update_defect(workitem_id, title=None, description=None, root_cause=None, screenshot_dir=None):
    """更新已有缺陷"""
    token, org_id, space_id = load_credentials()
    headers = get_headers(token)

    body = {}
    if title:
        body["subject"] = title
    if description:
        body["description"] = description
    if root_cause:
        body["564b87a47ec3cc38200eb22606"] = root_cause

    if not body:
        print("❌ 没有需要更新的字段")
        return False

    url = f"{DOMAIN}/oapi/v1/projex/organizations/{org_id}/workitems/{workitem_id}"
    resp = requests.put(url, headers=headers, json=body, timeout=30)

    if resp.status_code == 204:
        print(f"  ✅ 更新成功! ID={workitem_id}")
        return True
    else:
        print(f"  ❌ 更新失败 HTTP {resp.status_code}")
        try:
            err = resp.json()
            print(f"     {err.get('errorMessage', resp.text[:300])}")
        except:
            print(f"     {resp.text[:300]}")
        return False


def get_defect(workitem_id):
    """查询缺陷详情"""
    token, org_id, space_id = load_credentials()
    headers = get_headers(token)

    url = f"{DOMAIN}/oapi/v1/projex/organizations/{org_id}/workitems/{workitem_id}"
    resp = requests.get(url, headers=headers, timeout=15)

    if resp.status_code == 200:
        return resp.json()
    else:
        print(f"❌ 查询失败 HTTP {resp.status_code}: {resp.text[:200]}")
        return None


def batch_submit(defects_file, screenshot_dir=None, dry_run=False):
    """批量提交缺陷"""
    with open(defects_file, 'r', encoding='utf-8') as f:
        defects = json.load(f)

    if not isinstance(defects, list):
        defects = [defects]

    print(f"📋 共 {len(defects)} 条缺陷待提交")
    if dry_run:
        print("⚠️ DRY RUN 模式 — 不实际提交\n")
    else:
        print()

    results = []
    for i, defect in enumerate(defects, 1):
        print(f"[{i}/{len(defects)}] {defect.get('tc_id', '')} ({defect.get('severity', 'P1')})")
        result = create_defect(defect, screenshot_dir, dry_run)
        results.append(result)

        if not dry_run and i < len(defects):
            time.sleep(1)  # 避免频率限制

    print(f"\n{'='*50}")
    success = sum(1 for r in results if r)
    print(f"✅ 成功: {success}/{len(defects)}")
    if not dry_run:
        for r in results:
            if r and r.get("id"):
                print(f"  - {r['id']}: {r.get('subject', '')}")

    return results


# ============================================================
# 命令行入口
# ============================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="云效缺陷自动提单")
    parser.add_argument("--defect", help="单条缺陷JSON文件路径")
    parser.add_argument("--batch", help="批量缺陷JSON文件路径")
    parser.add_argument("--update", help="更新已有缺陷，传入workitemId")
    parser.add_argument("--title", help="更新标题")
    parser.add_argument("--description", help="更新描述")
    parser.add_argument("--root-cause", help="更新问题原因")
    parser.add_argument("--screenshot-dir", help="截图目录路径")
    parser.add_argument("--dry-run", action="store_true", help="只打印不提交")
    args = parser.parse_args()

    if args.update:
        update_defect(args.update, args.title, args.description, args.root_cause, args.screenshot_dir)
    elif args.defect:
        with open(args.defect, 'r', encoding='utf-8') as f:
            defect = json.load(f)
        create_defect(defect, args.screenshot_dir, args.dry_run)
    elif args.batch:
        batch_submit(args.batch, args.screenshot_dir, args.dry_run)
    else:
        parser.print_help()
