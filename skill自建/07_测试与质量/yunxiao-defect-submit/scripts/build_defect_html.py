#!/usr/bin/env python3
"""
build_defect_html.py — 云效缺陷描述HTML生成器

按8段模板 + 双引号+紧凑+hr分隔规范生成description字段。
直接调用 build_defect_html() 返回可用HTML字符串。

使用示例：
    from build_defect_html import build_defect_html
    
    html = build_defect_html(
        precondition="已登录admin...",
        system_url="https://test.esicint.com/...",
        user_account="admin / Esic@2024",
        supplier_account="无",
        steps_html="<p>1. xxx → yyy</p>...",
        problem_html="<p>具体问题描述</p>",
        expected_html="<p>正常应该...</p>",
        root_cause="前端组件未渲染",
    )
    
    requests.put(url, json={"description": html, "formatType": "RICHTEXT"})

⚠️ 关键约束（2026-07-08血泪教训）：
1. HTML属性值用双引号
2. HTML紧凑无换行（用单引号Python字符串包裹）
3. 各段用<hr>分隔
4. formatType=RICHTEXT（不要用MARKDOWN）
"""

import base64
import os


def build_defect_html(
    precondition: str,
    system_url: str,
    user_account: str,
    supplier_account: str,
    steps_html: str,
    problem_html: str,
    expected_html: str,
    root_cause: str,
) -> str:
    """
    生成符合云效RICHTEXT渲染规范的8段描述HTML。
    
    关键点：
    - 用单引号Python字符串包裹，HTML内双引号无需转义
    - 用()多行隐式拼接，无换行符
    - 段间用<hr>分隔
    
    返回的HTML可以直接作为description字段，配合formatType=RICHTEXT提交。
    """
    html = (
        '<article class="4ever-article">'
        f'<p><strong>前置：</strong>{precondition}</p>'
        f'<p>问题链接：{system_url}</p>'
        f'<p>用户账号：{user_account}</p>'
        f'<p>供应商账号：{supplier_account}</p>'
        '<hr>'
        '<p><strong>步骤：</strong></p>'
        f'{steps_html}'
        '<hr>'
        '<p><strong>问题：</strong></p>'
        f'{problem_html}'
        '<hr>'
        '<p><strong>期望：</strong></p>'
        f'{expected_html}'
        '<hr>'
        '<p><strong>定位：</strong></p>'
        f'<p>{root_cause}</p>'
        '</article>'
    )
    return html


def build_steps_html(steps: list, screenshot_dir: str = None, max_screenshots: int = 3) -> str:
    """
    从 [{"action": "xxx", "result": "yyy"}, ...] 生成步骤HTML。
    
    可选地在每步后插入最多max_screenshots张截图（按step索引）。
    截图命名约定：{screenshot_dir}/{tc_id}_step{N}.png
    """
    parts = []
    for i, step in enumerate(steps, 1):
        action = step.get("action", "")
        result = step.get("result", "")
        if "预期" in action or "预期" in result:
            continue
        
        step_html = f"<p>{i}. {action}"
        if result:
            step_html += f" → {result}"
        step_html += "</p>"
        parts.append(step_html)
        
        # 插入截图（按需）
        if screenshot_dir and i <= max_screenshots:
            # 兼容多种命名约定
            for pattern in [f"step{i}.png", f"_step{i}_", f"-step{i}-"]:
                for fname in os.listdir(screenshot_dir) if os.path.exists(screenshot_dir) else []:
                    if pattern in fname and fname.endswith(".png"):
                        sc_path = os.path.join(screenshot_dir, fname)
                        with open(sc_path, "rb") as f:
                            b64 = base64.b64encode(f.read()).decode()
                        parts.append(
                            f'<p><img src="data:image/png;base64,{b64}" '
                            f'style="max-width:100%;border:1px solid #ddd;border-radius:4px"/></p>'
                        )
                        break
                else:
                    continue
                break
    
    return "".join(parts)


# SRMPRO项目固定参数
SRMPRO_FIXED_PARAMS = {
    "system_url": "https://test.esicint.com/SupplierManagement/newDocument",
    "default_user_account": "admin / Esic@2024",
    "default_supplier_account": "无",
}


if __name__ == "__main__":
    # 演示用法
    html = build_defect_html(
        precondition="SRMPRO文档库模块，已登录admin账号，页面正常加载",
        system_url=SRMPRO_FIXED_PARAMS["system_url"],
        user_account=SRMPRO_FIXED_PARAMS["default_user_account"],
        supplier_account=SRMPRO_FIXED_PARAMS["default_supplier_account"],
        steps_html="<p>1. 进入文档库 → 正常</p><p>2. 点击搜索 → 弹窗未弹出</p>",
        problem_html="<p>点击节点后未检测到弹窗</p>",
        expected_html="<p>点击节点应弹出详情弹窗</p>",
        root_cause="前端事件处理逻辑缺失",
    )
    print(html)
