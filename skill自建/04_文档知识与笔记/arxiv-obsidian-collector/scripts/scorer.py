#!/usr/bin/env python3
"""
论文质量评分器: 0-10 分 + 理由 + 一句话总结。
供 pipeline.py 在生成 Obsidian 笔记前调用。

设计要点:
- 使用 Anthropic Messages API(给 MiniMax-M3 /anthropic 端点)
- 严格 JSON 输出靠 prompt trick(Anthropic 不支持 response_format)
- 评分失败兜底,不让流水线挂
- 评分数据写回 frontmatter + .rejected-*.json 留底
"""

import io
import json
import os
import re
import sys

# Windows GBK 终端兜底(同 pipeline.py / dispatcher.py)
for _stream_name in ("stdout", "stderr"):
    _stream = getattr(sys, _stream_name, None)
    if _stream is None:
        continue
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except (AttributeError, io.UnsupportedOperation):
        try:
            _buf = _stream.buffer  # type: ignore[attr-defined]
        except AttributeError:
            continue
        setattr(sys, _stream_name, io.TextIOWrapper(_buf, encoding="utf-8", errors="replace"))
from typing import Any
from anthropic import Anthropic


# ==================== 网络代理兜底 ====================
# 用户电脑出口走 HTTP proxy(127.0.0.1:7892,Clash/Mihomo 类)。
# 当前 shell 通常已继承该 env,但 mavis cron 启动的子进程可能不带,
# 所以这里显式补一次。CA bundle 同步带上,避免代理的 MITM 证书被拒。
_DEFAULT_PROXY = "http://127.0.0.1:7892"
_DEFAULT_CA = r"C:\Users\AaronMY\AppData\Roaming\MiniMax\system-ca-certs.pem"
for _k in ("HTTPS_PROXY", "HTTP_PROXY"):
    os.environ.setdefault(_k, _DEFAULT_PROXY)
os.environ.setdefault("NO_PROXY", "localhost,127.0.0.1,::1")
if os.path.exists(_DEFAULT_CA):
    os.environ.setdefault("REQUESTS_CA_BUNDLE", _DEFAULT_CA)
    os.environ.setdefault("SSL_CERT_FILE", _DEFAULT_CA)


SCORER_PROMPT = """你是 AI 论文质量评审,只看质量,不打人情分。

评分维度与权重:
- 原创性 (35%): 新方法 / 新视角 vs rehash / 套用既有工作
- 实证强度 (25%): 实验扎实度、ablation、与 SOTA 对比
- 严谨性 (20%): 理论分析、假设合理性、局限性讨论
- 实用价值 (10%): 工程可用性、可复现性
- 表达清晰度 (10%): 摘要清晰可读

参考分数线:
- 9-10 突破性工作(NeurIPS oral 级)
- 7-8   高质量,值得精读
- 5-6   一般,可读可不读
- 3-4   重复度高或实证薄弱
- 0-2   明显方法缺陷或不可复现

扣分项:
- 纯综述无新观点,上限 5(即使写得好)
- 仅有 idea 没有实验,上限 4
- 跨领域强套用 / 拼凑工作,扣 2 分

论文元信息:
- 标题: {title}
- 作者: {authors}
- 分类: [{layer} / {category}]
- arXiv 摘要: {summary}

PDF 节选(前 4 页):
{pdf_text}

请只输出严格 JSON,不要任何额外文字、不要 markdown 代码块:
{{
  "score": 7.5,
  "category": "high_quality",
  "reasons": ["理由 1", "理由 2", "理由 3"],
  "tl_dr": "一句话总结本文做了什么、有何贡献"
}}
"""


def _bucket(score: float) -> str:
    if score >= 8:
        return "high_quality"
    if score >= 6:
        return "medium_quality"
    if score >= 4:
        return "low_quality"
    return "reject"


def _extract_json(text: str) -> dict:
    """Anthropic 不强制 JSON,模型可能包 ```json``` 或夹文本,
    用正则兜底提取最外层 {...}。"""
    # 先试严格 parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # 抓 ```json ... ``` 块
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    # 抓第一个 { ... } 块(贪心到最后一个 })
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        candidate = m.group(0)
        # 修复 1: 去掉 trailing comma(`, ]` 或 `, }`)
        candidate_fixed = re.sub(r",\s*([}\]])", r"\1", candidate)
        if candidate_fixed != candidate:
            try:
                return json.loads(candidate_fixed)
            except json.JSONDecodeError:
                pass
        # 修复 2: 缺闭合括号(常见于 max_tokens 截断)
        opens = candidate.count("{") - candidate.count("}")
        if opens > 0:
            try:
                return json.loads(candidate + "}" * opens)
            except json.JSONDecodeError:
                pass
    raise ValueError(f"无法从 LLM 输出解析 JSON: {text[:200]}...")


def _call_text(client: Anthropic, *, model: str, system: str, user: str,
               temperature: float = 0.3, max_tokens: int = 2000) -> str:
    """Anthropic messages.create → text。

    Anthropic 响应 content 是 list(可能含 TextBlock / ThinkingBlock / ToolUse 等),
    我们取第一个 text block。"""
    resp = client.messages.create(
        model=model,
        system=system,
        messages=[{"role": "user", "content": user}],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    for block in resp.content:
        if hasattr(block, "text"):
            return block.text
    raise RuntimeError(f"无 text content: {resp.content}")


def score_paper(
    paper: dict,
    layer: str,
    category: str,
    pdf_text: str,
    *,
    model: str,
    client: Anthropic,
) -> dict[str, Any]:
    """对单篇论文评分。返回 dict: score / category / reasons / tl_dr。

    鲁棒性:
    - max_tokens 提高到 1500 防止 reasons 过长截断
    - JSON 解析失败时重试 1 次,提示 LLM 用更紧凑的格式
    - 解析时做 trailing comma / 缺闭合括号 基础修复
    """
    try:
        prompt = SCORER_PROMPT.format(
            layer=layer,
            category=category,
            title=paper["title"],
            authors=", ".join(paper["authors"]),
            summary=paper["summary"],
            pdf_text=pdf_text[:4000],
        )
        # 第一次尝试
        text = _call_text(
            client, model=model,
            system="严格的 AI 论文评审,只看质量,不捧场。",
            user=prompt, temperature=0.1, max_tokens=1500,
        )
        try:
            data = _extract_json(text)
        except ValueError:
            # 解析失败,重试 1 次:让 LLM 输出更紧凑的 JSON(reasons 限 80 字内)
            retry_prompt = (
                prompt
                + "\n\n重要:上一次输出 JSON 格式不合法或被截断。"
                  "请重新输出严格 JSON,reasons 每条不超过 60 字(原 80 字内),"
                  "tl_dr 不超过 100 字。不要任何额外文字、不要 markdown 代码块。"
            )
            text = _call_text(
                client, model=model,
                system="严格的 AI 论文评审,只看质量,不捧场。",
                user=retry_prompt, temperature=0.0, max_tokens=1200,
            )
            data = _extract_json(text)

        score = float(data.get("score", 0))
        return {
            "score": score,
            "category": data.get("category", _bucket(score)),
            "reasons": (data.get("reasons") or [])[:5],
            "tl_dr": (data.get("tl_dr") or "")[:200],
        }
    except Exception as e:
        print(f"    [WARN] 评分失败 [{paper.get('id', '?')}]: {e}")
        return {
            "score": 5.0,
            "category": "unknown",
            "reasons": [f"scoring failed: {e}"],
            "tl_dr": "",
        }


def should_keep(score: float, threshold: float = 5.0) -> bool:
    """默认 5.0,低于阈值不生成 Obsidian 笔记。"""
    return score >= threshold


def make_minimax_client(
    api_base: str,
    api_key_env: str = "MINIMAX_M3_API_KEY",
) -> Anthropic:
    """
    构造 MiniMax-M3 客户端(Anthropic Messages API)。

    env 优先级:
    1. <api_key_env>   (config.yaml 里配的,默认 MINIMAX_M3_API_KEY)
    2. ANTHROPIC_API_KEY  (兼容官方 SDK 用法)
    3. OPENAI_API_KEY     (兜底)
    """
    api_key = (
        os.environ.get(api_key_env)
        or os.environ.get("ANTHROPIC_API_KEY")
        or os.environ.get("OPENAI_API_KEY", "")
    )
    if not api_key:
        raise RuntimeError(
            f"未配置 API Key。请设置 {api_key_env} 环境变量,或临时用 ANTHROPIC_API_KEY。"
        )
    return Anthropic(api_key=api_key, base_url=api_base)


def call_llm(
    client: Anthropic,
    *,
    model: str,
    system: str,
    user: str,
    temperature: float = 0.3,
    max_tokens: int = 2000,
) -> str:
    """对外暴露的统一文本 LLM 调用接口(供 pipeline 摘要使用)。"""
    return _call_text(
        client, model=model, system=system, user=user,
        temperature=temperature, max_tokens=max_tokens,
    )
