#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""zap_scaffold.py — 一键创建 OPRASE 六层安全测试项目骨架

用法：
  python3 zap_scaffold.py --target /path/to/新项目
  python3 zap_scaffold.py --target .  # 当前目录

创建目录结构：
  00-OPRASE顶层.md  01-工具.md  02-SOP.md  03-基础信息.md
  04-测试过程/(script/testdata/testcase)
  05-测试报告/(01-ZAP原始/02-分析/03-白话/04-正式)
  06-复盘/(00-原始Session/01-深度复盘/02-双三角)

先建好骨架，再逐个环节推进，不必一次扫完。
"""
import argparse, os

def scaffold(root):
    dirs = [
        "04-测试过程/script", "04-测试过程/testdata", "04-测试过程/testcase",
        "05-测试报告/01-ZAP原始报告", "05-测试报告/02-分析数据",
        "05-测试报告/03-白话版报告", "05-测试报告/04-正式安全评估报告",
        "06-复盘/00-原始Session沟通",
    ]
    tpl_md = {
        "00-顶层文档-OPRASE格式.md":
"""# OPRASE · [站点名] 安全评估

## O（目标）
对目标站点进行一次授权登录态全量安全测试，输出标准化交付物。

## P（方法/计划）
ZAP 2.17 daemon → 直连验证 → 手工会话注入 → Spider(10min限) → 模板抽样(200-300页) → Active Scan(3线程/50ms) → 人工复核 → 脱敏导出 → QC → 交付

## R（数据/资源）
见 03-被测网站信息和基础信息.md
""",
        "01-使用工具概要和skill.md":
"""# 工具与 Skill 清单

| 工具 | 用途 |
|---|---|
| OWASP ZAP 2.17 daemon | 主扫描引擎 |
| web-security-scanning (v2.2.0+) | ZAP 安全测试 skill + scripts/ 三工具 |
| token-usage-meter (v1.0) | 按最小循环单元监控 token |
| html-to-pdf-report | 腾讯样式 PDF 报告 |
| double-triangle-review | AI 双三角复盘 |
""",
        "02-本次执行积累的SOP.md":
"""# 本次 SOP（待回填）

> 版本 v0.1

- [ ] 授权红线已过
- [ ] ZAP 仅 127.0.0.1
- [ ] 凭据环境变量化
- [ ] 写操作 URL 排除
- [ ] Spider maxDuration 已设
- [ ] 主动扫描限速已配

登录注入/限速/误报/熔断纪律详见 web-security-scanning skill。
""",
        "03-被测网站信息和基础信息.md":
"""# 被测网站基础信息

> ⚠️ 敏感信息仅存本机，不进交付目录

- URL：
- 登录 URL：
- 登录账号：见环境变量
- 排除路径：
- 浏览器版本：
"""
    }
    os.makedirs(root, exist_ok=True)
    for d in dirs:
        os.makedirs(os.path.join(root, d), exist_ok=True)
    for fn, c in tpl_md.items():
        fp = os.path.join(root, fn)
        if not os.path.exists(fp):
            open(fp, "w", encoding="utf-8").write(c)
            print(f"  created {fn}")
        else:
            print(f"  exists {fn} (skip)")
    print(f"\nDone: {root}")
    print("→ 下一步: zap_preflight.py → 登录注入 → spider → ascan → review → QC → 交付")

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Create OPRASE 6-layer security test KB")
    ap.add_argument("--target", required=True)
    scaffold(ap.parse_args().target)