#!/usr/bin/env python3
"""
auto_assess.py — 自动评分核心逻辑

调用流程:
  1. 调用方读 references/eval_prompt.md 的"评分 Prompt(主)"
  2. 注入素材,调 LLM,得到 raw JSON
  3. 把 raw JSON 喂给 parse_assessment_json()
  4. 校验 + 补全维度汇总
  5. 返回结构化 dict

用法:
  from auto_assess import parse_assessment_json, validate_scores, calculate_levels
  result = parse_assessment_json(llm_raw_json_str)
  validate_scores(result)
  report_data = calculate_levels(result)
"""

import json
import re
from pathlib import Path

# ==================== 元数据 ====================
SCRIPT_DIR = Path(__file__).parent
DATA_FILE = SCRIPT_DIR.parent / "references" / "assessment-data.json"

SUB_MODULE_META = {}  # sid -> {name, dim, dimName, order, desc, full_name}
DIM_META = {}  # dim key -> {name, fullName, color, subs}


def load_metadata():
    """从 references/assessment-data.json 加载子模块 + 维度元数据"""
    global SUB_MODULE_META, DIM_META
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))

    for s in data["sub_modules"]:
        SUB_MODULE_META[s["sid"]] = {
            "name": s["name"],
            "dim": s["dim"],
            "dimName": s["dimName"],
            "order": int(s["order"]),
            "desc": s["desc"],
        }

    for d in data["dimensions"]:
        DIM_META[d["key"]] = {
            "name": d["name"],
            "fullName": d["fullName"],
            "color": d["color"],
            "light": d["light"],
            "subs": d["subs"],
            "max_score": len(d["subs"]) * 20,
            "n_subs": len(d["subs"]),
        }

    # 系统三角里 S1-S4 在人(体系)和 AI(场景)各出现一次,这是预期的


# ==================== 解析 ====================
def parse_assessment_json(raw: str) -> dict:
    """
    从 LLM 返回的 raw 字符串提取 JSON。
    兼容以下格式:
      - 纯 JSON
      - ```json ... ``` 包裹
      - 前后有 prose
    """
    # 尝试直接 parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # 尝试提取 ```json ... ``` 块
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass

    # 尝试找第一个 { ... } 块(贪心)
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"无法从 LLM 输出解析 JSON: {raw[:200]}...")


# ==================== 校验 ====================
REQUIRED_SUBS = [
    "A1", "A2", "A3", "A4",
    "S1", "S2", "S3", "S4",  # 人(体系)三角
    "I1", "I2", "I3", "I4", "I5", "I6",
    "S1", "S2", "S3", "S4",  # AI(场景)三角 — 同名 sid 需特殊处理
    "K1", "K2", "K3", "K4", "K5",
    "D1", "D2", "D3", "D4",
]


def validate_scores(data: dict) -> dict:
    """
    校验 LLM 输出,补全缺失字段。
    注意:S1-S4 在人(体系)和 AI(场景)各出现一次,需要用带前缀的 key 区分:
      - S1_人 / S2_人 / S3_人 / S4_人
      - S1_AI / S2_AI / S3_AI / S4_AI
    """
    sub_scores = data.get("sub_scores", {})

    # 重命名 S1-S4 为带前缀的 key
    fixed_sub_scores = {}
    for sid, val in sub_scores.items():
        if sid == "S1":
            # 哪个 dim 还没填? 看 evidence
            ev = (val.get("evidence", "") if isinstance(val, dict) else "")
            if "散点" in ev or "整理" in ev or "知识管理" in ev:
                fixed_sub_scores["S1_人"] = val
            else:
                fixed_sub_scores["S1_AI"] = val
        elif sid == "S2":
            ev = (val.get("evidence", "") if isinstance(val, dict) else "")
            if "聚焦" in ev or "TopN" in ev or "放弃次要" in ev:
                fixed_sub_scores["S2_人"] = val
            else:
                fixed_sub_scores["S2_AI"] = val
        elif sid == "S3":
            ev = (val.get("evidence", "") if isinstance(val, dict) else "")
            if "MECE" in ev or "分类" in ev or "框架" in ev:
                fixed_sub_scores["S3_人"] = val
            else:
                fixed_sub_scores["S3_AI"] = val
        elif sid == "S4":
            ev = (val.get("evidence", "") if isinstance(val, dict) else "")
            if "因果" in ev or "逻辑链" in ev:
                fixed_sub_scores["S4_人"] = val
            else:
                fixed_sub_scores["S4_AI"] = val
        else:
            fixed_sub_scores[sid] = val

    data["sub_scores"] = fixed_sub_scores

    # 校验所有必需的子模块都存在
    expected_keys = [
        "A1", "A2", "A3", "A4",
        "S1_人", "S2_人", "S3_人", "S4_人",
        "I1", "I2", "I3", "I4", "I5", "I6",
        "S1_AI", "S2_AI", "S3_AI", "S4_AI",
        "K1", "K2", "K3", "K4", "K5",
        "D1", "D2", "D3", "D4",
    ]
    missing = [k for k in expected_keys if k not in fixed_sub_scores]
    if missing:
        raise ValueError(f"评估结果缺少子模块: {missing}")

    # 校验分数范围 0-20
    for sid, val in fixed_sub_scores.items():
        if isinstance(val, dict):
            score = val.get("score", 0)
        else:
            score = val
        if not (0 <= score <= 20):
            raise ValueError(f"{sid} 分数 {score} 超出 0-20 范围")

    return data


# ==================== 维度汇总 ====================
DIM_SUBS = {
    "aesthetic": ["A1", "A2", "A3", "A4"],
    "system_人": ["S1_人", "S2_人", "S3_人", "S4_人"],
    "innovation": ["I1", "I2", "I3", "I4", "I5", "I6"],
    "scene_AI": ["S1_AI", "S2_AI", "S3_AI", "S4_AI"],
    "skill": ["K1", "K2", "K3", "K4", "K5"],
    "data": ["D1", "D2", "D3", "D4"],
}

DIM_DISPLAY_NAMES = {
    "aesthetic": "审美",
    "system_人": "体系",
    "innovation": "创新",
    "scene_AI": "场景",
    "skill": "基本功",
    "data": "数据",
}

DIM_MAX_SCORES = {
    "aesthetic": 80,
    "system_人": 80,
    "innovation": 120,
    "scene_AI": 80,
    "skill": 100,
    "data": 80,
}


def calculate_levels(data: dict) -> dict:
    """
    计算每个维度的总分、百分比、段位。
    输入 data 必须是 validate_scores 后的格式。
    """
    sub_scores = data["sub_scores"]

    dim_summary = {}
    for dim_key, sub_keys in DIM_SUBS.items():
        total = 0
        for sid in sub_keys:
            val = sub_scores[sid]
            score = val["score"] if isinstance(val, dict) else val
            total += score

        max_score = DIM_MAX_SCORES[dim_key]
        percent = round(total / max_score * 100)

        if percent < 30:
            level = "初阶"
        elif percent < 60:
            level = "进阶段"
        else:
            level = "高阶"

        dim_summary[dim_key] = {
            "name": DIM_DISPLAY_NAMES[dim_key],
            "total": total,
            "max": max_score,
            "percent": percent,
            "level": level,
        }

    # 综合分
    overall_total = sum(d["total"] for d in dim_summary.values())
    overall_max = sum(DIM_MAX_SCORES.values())  # 540
    overall_percent = round(overall_total / overall_max * 100)

    if overall_percent < 30:
        overall_level = "初阶"
    elif overall_percent < 60:
        overall_level = "进阶段"
    else:
        overall_level = "高阶"

    data["dim_summary"] = dim_summary
    data["overall"] = {
        "total": overall_total,
        "max": overall_max,
        "percent": overall_percent,
        "level": overall_level,
    }

    # 找最大瓶颈
    weakest = min(dim_summary.items(), key=lambda x: x[1]["percent"])
    data["bottleneck_dim"] = weakest[0]
    data["bottleneck"] = f"{weakest[1]['name']}({weakest[1]['percent']}%)"

    # 找最强维度
    strongest = max(dim_summary.items(), key=lambda x: x[1]["percent"])
    data["strength_dim"] = strongest[0]
    data["strength"] = f"{strongest[1]['name']}({strongest[1]['percent']}%)"

    return data


# ==================== 主流程 ====================
def assess_from_raw(raw: str) -> dict:
    """
    完整流程:raw LLM 输出 → 结构化、可视化的评估数据。
    返回 dict,可直接喂给 generate_report.py。
    """
    load_metadata()
    data = parse_assessment_json(raw)
    data = validate_scores(data)
    data = calculate_levels(data)
    return data


if __name__ == "__main__":
    # 自检:载入 metadata
    load_metadata()
    print(f"Loaded {len(SUB_MODULE_META)} sub-modules")
    print(f"Loaded {len(DIM_META)} dimensions")
    expected_keys = [
        "A1", "A2", "A3", "A4",
        "S1_人", "S2_人", "S3_人", "S4_人",
        "I1", "I2", "I3", "I4", "I5", "I6",
        "S1_AI", "S2_AI", "S3_AI", "S4_AI",
        "K1", "K2", "K3", "K4", "K5",
        "D1", "D2", "D3", "D4",
    ]
    print(f"Required sub keys: {len(expected_keys)}")