#!/usr/bin/env python3
"""
arXiv to Obsidian — 流水线
搜索 -> 下载 PDF -> 提取文本 -> 评分过滤 -> LLM 中文摘要 -> Obsidian Markdown

参数:
    --layer NAME    只跑某层(可选;缺省跑全部 5 层,用于全量回填)
    --config PATH   自定义 config.yaml 路径(默认 ./config.yaml)
    --test          测试模式: 第一层第一个分类,验证流程

例:
    python scripts/pipeline.py --layer "第一层-专用小模型"
    python scripts/pipeline.py --test
"""

import argparse
import datetime
import io
import json
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import requests
import yaml

# Windows GBK 终端兜底:重设 stdout/stderr 为 UTF-8,避免 emoji / 中文打印崩溃
for _stream_name in ("stdout", "stderr"):
    _stream = getattr(sys, _stream_name, None)
    if _stream is None:
        continue
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except (AttributeError, io.UnsupportedOperation):
        # 老 Python 或已被重定向(无 reconfigure),回退到 TextIOWrapper 包一层
        try:
            _buf = _stream.buffer  # type: ignore[attr-defined]
        except AttributeError:
            continue
        setattr(sys, _stream_name, io.TextIOWrapper(_buf, encoding="utf-8", errors="replace"))

from scorer import score_paper, should_keep, make_minimax_client, call_llm


# ==================== 网络代理兜底 ====================
# 当前 shell 通常已带代理 env,mavis cron 启动的子进程可能不带。
# 这里硬补一次,确保 arXiv PDF 下载 + LLM 调用都走代理。
_DEFAULT_PROXY = "http://127.0.0.1:7892"
_DEFAULT_CA = r"C:\Users\AaronMY\AppData\Roaming\MiniMax\system-ca-certs.pem"
for _k in ("HTTPS_PROXY", "HTTP_PROXY"):
    os.environ.setdefault(_k, _DEFAULT_PROXY)
os.environ.setdefault("NO_PROXY", "localhost,127.0.0.1,::1")
if os.path.exists(_DEFAULT_CA):
    os.environ.setdefault("REQUESTS_CA_BUNDLE", _DEFAULT_CA)
    os.environ.setdefault("SSL_CERT_FILE", _DEFAULT_CA)


# ==================== API Key 兜底(daemon env 快照绕过) ====================
# 2026-08-24 发现:mavis daemon 启动时快照 env,之后 bash tool 进程改的 $env 不会
# 同步到 daemon 起的 cron 子进程。子进程拿到的 MINIMAX_M3_API_KEY 可能是占位符,
# LLM 全 401。这里强制用 ctypes 现读 Windows User-env(注册表级别),覆盖占位符。
# os.environ.get() 在 daemon 子进程里读到的也是占位符,所以必须用 Win32 API 现读。
if sys.platform == "win32" and len(os.environ.get("MINIMAX_M3_API_KEY", "")) < 50:
    try:
        import ctypes
        from ctypes import wintypes
        _buf = ctypes.create_unicode_buffer(2048)
        _n = ctypes.windll.kernel32.GetEnvironmentVariableW("MINIMAX_M3_API_KEY", _buf, 2048)
        if _n > 0 and len(_buf.value) >= 50:
            os.environ["MINIMAX_M3_API_KEY"] = _buf.value
            print(f"  [env-fixup] MINIMAX_M3_API_KEY 从 Windows User-env 现读到 (len={len(_buf.value)})")
    except Exception as _e:
        print(f"  [env-fixup] GetEnvironmentVariableW 失败(忽略): {_e}")


# ==================== 配置加载 ====================
DEFAULT_CONFIG = {
    "vault_dir": "./arxivForAI",
    "search_days": 7,
    "max_results_per_query": 5,
    "max_papers_per_category": 5,
    "model": "m3",
    "quality_scorer_model": "m3",
    "api_base": "http://localhost:8000/v1",
    "api_key_env": "MINIMAX_M3_API_KEY",
    "pdf_max_pages": 4,
    "quality_threshold": 5.0,
}


def load_config(path: str) -> dict:
    candidates = []
    p = Path(path)
    if p.is_absolute():
        candidates.append(p)
    else:
        # 优先 skill 根目录(与 config.yaml 同级),其次脚本目录
        candidates.append(Path(__file__).parent.parent / path)
        candidates.append(Path(__file__).parent / path)
    found = next((c for c in candidates if c.exists()), None)
    if found:
        with open(found, encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}
        merged = {**DEFAULT_CONFIG, **cfg}
    else:
        print(f"⚠️  未找到配置 {path},使用默认值")
        merged = DEFAULT_CONFIG.copy()
    # vault_dir 始终解析为绝对路径
    merged["vault_dir"] = str(Path(merged["vault_dir"]).resolve())
    return merged


# ==================== 五层分类体系 ====================
SEARCH_CATEGORIES = {
    "第一层-专用小模型": {
        "轻量化模型架构": ["lightweight model architecture", "compact neural network", "TinyBERT", "small language model", "efficient model design"],
        "模型量化与压缩": ["model quantization", "model pruning", "knowledge distillation", "INT4 quantization", "weight compression"],
        "边缘端推理部署": ["edge AI deployment", "on-device inference", "embedded AI", "TinyML", "model optimization for edge"],
        "领域微调技术": ["domain-specific fine-tuning", "LoRA", "QLoRA", "PEFT", "parameter efficient fine-tuning", "adapter tuning"],
        "小样本与零样本学习": ["few-shot learning", "zero-shot learning", "meta-learning", "low-resource NLP", "data-efficient learning"],
        "视觉专用小模型": ["vision foundation model", "object detection", "image classification small model", "YOLO", "ViT small"],
        "语音专用小模型": ["speech recognition small model", "wake word detection", "on-device ASR", "Whisper small", "voice model"],
        "代码生成小模型": ["code generation model", "code LLM", "small code model", "CodeBERT", "StarCoder", "code completion model"],
        "数学与逻辑推理小模型": ["math reasoning small model", "symbolic reasoning", "theorem proving", "MathBERT", "formal verification model"],
        "AI软件测试模型": ["AI software testing", "machine learning testing", "neural network testing", "test oracle generation", "mutation testing"],
        "轻量化Embedding模型": ["lightweight embedding model", "small sentence transformer", "efficient text embedding", "bi-encoder", "cross-encoder"],
        "传统软件测试": ["software testing", "test case generation", "automated testing", "regression testing", "unit testing"],
        "AItesting": ["AI testing", "testing AI systems", "AI quality assurance", "AI model testing", "ML testing"],
        "内容安全检测模型": ["content moderation model", "toxicity detection", "hate speech detection", "safety classifier", "harmful content detection"],
        "幻觉检测与事实核查": ["hallucination detection", "factual consistency", "fact verification model", "faithfulness evaluation", "grounding evaluation"],
    },
    "第二层-大模型基底层": {
        "Transformer架构与改进": ["transformer architecture", "attention mechanism", "efficient transformer", "state space model", "Mamba", "linear attention"],
        "模型训练原理": ["model pretraining", "instruction tuning", "RLHF", "supervised fine-tuning", "DPO", "PPO training LLM"],
        "大模型量化与压缩": ["model quantization", "model pruning", "knowledge distillation", "efficient inference", "INT4 quantization", "weight compression"],
        "预训练数据工程": ["pretraining data curation", "data quality filtering", "synthetic data generation", "web crawl dataset", "data deduplication"],
        "持续学习与遗忘": ["continual learning LLM", "catastrophic forgetting", "lifelong learning", "model updating", "incremental learning"],
        "多模态大模型": ["multimodal large language model", "vision language model", "multimodal foundation model", "omni model"],
        "视觉理解与生成": ["visual understanding", "image generation model", "diffusion model", "text-to-image", "visual grounding"],
        "语音与音频大模型": ["speech language model", "audio LLM", "automatic speech recognition", "text-to-speech", "voice synthesis"],
        "世界模型": ["world model", "world model learning", "latent world model", "embodied world model", "video prediction model"],
        "大模型推理能力": ["LLM reasoning", "chain-of-thought", "mathematical reasoning", "logical reasoning LLM", "o1 reasoning", "thinking model"],
        "AGI": ["artificial general intelligence", "AGI evaluation", "general AI benchmark", "AGI alignment", "superhuman AI"],
        "Embedding与表示学习": ["text embedding", "sentence representation", "contrastive learning", "dense retrieval", "embedding model"],
        "向量数据库与检索": ["vector database", "approximate nearest neighbor", "semantic search", "embedding index", "FAISS", "Milvus"],
        "LLM大模型测试": ["LLM testing", "large language model evaluation", "LLM benchmark", "LLM capability assessment"],
        "AI安全与对齐测试": ["AI safety evaluation", "red teaming LLM", "jailbreak testing", "LLM alignment evaluation", "constitutional AI"],
        "AI系统基准测试": ["AI benchmark", "LLM evaluation framework", "foundation model benchmark", "leaderboard evaluation"],
    },
    "第三层-大模型组件层": {
        "MCP与工具调用协议": ["model context protocol", "LLM tool use", "function calling LLM", "tool augmented LLM", "API calling agent"],
        "LLM接口与集成标准": ["LLM API integration", "OpenAI compatible API", "LLM gateway", "model serving API", "LLM middleware"],
        "工作流自动化编排": ["LLM workflow automation", "AI orchestration", "LangChain", "LlamaIndex", "AI pipeline orchestration"],
        "低代码AI流程工具": ["low-code AI pipeline", "n8n AI workflow", "visual AI workflow", "no-code LLM", "Flowise", "Dify"],
        "提示工程与上下文管理": ["prompt engineering", "in-context learning", "context window management", "prompt optimization", "system prompt design"],
        "长上下文与记忆扩展": ["long context LLM", "extended context window", "external memory LLM", "memory augmented LLM", "infinite context"],
        "LLM推理加速": ["LLM inference optimization", "speculative decoding", "KV cache", "continuous batching", "vLLM", "TensorRT-LLM"],
        "模型部署与服务化": ["LLM serving", "model deployment", "inference server", "triton inference", "model as a service", "MLOps"],
        "文档解析与结构化提取": ["document parsing", "PDF extraction", "structured data extraction", "document understanding", "OCR LLM"],
        "数据连接器与集成": ["data connector LLM", "database query LLM", "text-to-SQL", "LLM data integration", "knowledge base connector"],
        "LLM可观测性与监控": ["LLM observability", "LLM tracing", "prompt logging", "LLM monitoring", "LangSmith", "LLM debugging"],
        "组件层测试与评估": ["LLM pipeline evaluation", "chain evaluation", "tool use evaluation", "workflow testing", "LLM component testing"],
    },
    "第四层-智能体工程层": {
        "agent框架": ["LLM agent framework", "agentic AI framework", "autonomous agent architecture", "ReAct agent", "agent system design"],
        "多智能体协作系统": ["multi-agent system", "multi-agent collaboration", "agent communication", "agent society", "cooperative agents"],
        "RAG技术": ["retrieval augmented generation", "RAG pipeline", "RAG evaluation", "knowledge-grounded generation", "advanced RAG"],
        "知识图谱与结构化知识": ["knowledge graph LLM", "graph RAG", "knowledge base agent", "structured knowledge retrieval", "entity linking"],
        "智能体记忆与规划": ["agent memory", "agent planning", "long-term memory LLM", "task planning agent", "goal decomposition"],
        "智能体反思与自我改进": ["agent self-reflection", "self-refinement LLM", "chain-of-thought agent", "agent introspection", "iterative reasoning"],
        "智能体工具使用与代码执行": ["agent tool use", "code execution agent", "computer use agent", "web browsing agent", "GUI agent"],
        "自主测试系统": ["autonomous testing system", "self-healing test automation", "autonomous software testing", "LLM-based test agent"],
        "机器人AI测试": ["robot testing", "robotic system evaluation", "vision language action model evaluation", "embodied AI evaluation"],
        "自动驾驶测试": ["autonomous driving testing", "testing autonomous vehicles", "safety critical scenario generation", "AV evaluation"],
        "智能体测试": ["LLM agent testing", "agent evaluation", "autonomous agent benchmark", "agent capability assessment"],
        "智能体安全与可信": ["agent safety", "LLM agent alignment", "agent red teaming", "trustworthy agent", "agent behavior verification"],
    },
    "第五层-行业应用层": {
        "生物医疗与基因": ["biomedical AI", "genomics AI", "gene sequencing LLM", "bioinformatics AI", "protein structure prediction", "drug discovery AI"],
        "AI医疗健康": ["AI medical diagnosis", "clinical AI evaluation", "medical LLM", "healthcare AI benchmark", "electronic health record AI"],
        "AI金融": ["AI finance", "financial LLM", "AI trading evaluation", "fintech AI benchmark", "risk assessment AI"],
        "AI教育": ["AI education K12", "intelligent tutoring system", "personalized learning AI", "educational LLM", "whole-person education AI", "learning assessment AI"],
        "AI安防与监控": ["AI surveillance", "video analytics AI", "anomaly detection AI", "security AI evaluation", "face recognition AI"],
        "AI法律与合规": ["legal AI", "LLM legal reasoning", "AI compliance", "legal NLP benchmark", "contract analysis AI"],
        "AI制造与工业": ["industrial AI", "manufacturing AI", "predictive maintenance AI", "AI quality inspection", "smart factory"],
        "AI零售与电商": ["AI retail", "recommendation system", "e-commerce AI", "personalization LLM", "consumer behavior AI"],
        "AI能源与环境": ["AI energy", "smart grid AI", "climate AI", "carbon emission prediction", "renewable energy AI"],
        "AI政务与公共服务": ["government AI", "public service LLM", "AI policy", "civic AI", "smart city AI"],
        "AI农业": ["agricultural AI", "precision farming AI", "crop disease detection", "smart agriculture", "food supply chain AI"],
    },
}


# ==================== ASCII 别名(供 mavis cron 调用) ====================
# 让 cron prompt 可以用纯 ASCII 短码,避免 prompt 经过 mavis storage 后
# unicode 被损坏。"L1"..="L5" 分别对应 5 层。原始中文层名仍可走 --layer。
LAYER_ALIAS = {
    "L1": "第一层-专用小模型",
    "L2": "第二层-大模型基底层",
    "L3": "第三层-大模型组件层",
    "L4": "第四层-智能体工程层",
    "L5": "第五层-行业应用层",
}


# ==================== arXiv API ====================
ARXIV_API = "https://export.arxiv.org/api/query"


def search_arxiv(query, max_results=5, retries=3):
    params = {
        "search_query": f"all:{query}",
        "start": 0,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    }
    for attempt in range(retries):
        try:
            time.sleep(3 + attempt * 5)
            resp = requests.get(ARXIV_API, params=params, timeout=60)
            if resp.status_code == 429:
                wait = 30 + attempt * 30
                print(f"    ⏳ 限流,等待 {wait}s 后重试...")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return parse_arxiv_response(resp.text)
        except requests.exceptions.Timeout:
            print(f"    ⏳ 超时,重试 {attempt+1}/{retries}...")
            time.sleep(10)
        except Exception as e:
            print(f"    ⚠️ 搜索失败 [{query}]: {e}")
            if attempt < retries - 1:
                time.sleep(10)
    return []


def parse_arxiv_response(xml_text):
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    results = []
    for entry in root.findall("atom:entry", ns):
        title = entry.find("atom:title", ns).text.strip().replace("\n", " ")
        summary = entry.find("atom:summary", ns).text.strip().replace("\n", " ")
        authors = [
            author.find("atom:name", ns).text
            for author in entry.findall("atom:author", ns)
        ]
        published = entry.find("atom:published", ns).text
        arxiv_id_full = entry.find("atom:id", ns).text
        arxiv_id = arxiv_id_full.split("/abs/")[-1]
        pdf_url = ""
        for link in entry.findall("atom:link", ns):
            if link.attrib.get("title") == "pdf":
                pdf_url = link.attrib.get("href")
                break
        if not pdf_url:
            pdf_url = arxiv_id_full.replace("abs", "pdf")

        results.append({
            "title": title,
            "summary": summary,
            "authors": authors,
            "published": published,
            "id": arxiv_id,
            "url": arxiv_id_full,
            "pdf_url": pdf_url,
        })
    return results


# ==================== 下载与提取 ====================
def download_pdf(url, save_path):
    try:
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
        with open(save_path, "wb") as f:
            f.write(resp.content)
        return True
    except Exception as e:
        print(f"    ❌ 下载 PDF 失败: {e}")
        return False


def extract_pdf_text(pdf_path, max_pages=4):
    import PyPDF2
    text = ""
    try:
        with open(pdf_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            num_pages = min(len(reader.pages), max_pages)
            for i in range(num_pages):
                page_text = reader.pages[i].extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        print(f"    ❌ 提取 PDF 文本失败: {e}")
    return text[:6000]


# ==================== LLM 摘要生成 ====================
def generate_summary(paper, layer, category, pdf_text, *, model, client):
    prompt = f"""
请阅读以下 arXiv 论文的信息和 PDF 前几页文本,生成一篇结构化的中文笔记,
专门用于 Obsidian 知识库。

论文信息:
- 标题: {paper['title']}
- 作者: {', '.join(paper['authors'])}
- 摘要: {paper['summary']}
- 所属分类: [{layer} / {category}]

PDF 文本节选:
{pdf_text}

请严格按照以下 Markdown 格式输出笔记内容(不要输出 ```markdown 标记,直接输出内容):

## 核心研究问题
(用 1-2 句话精准概括本文试图解决什么问题)

## 中文摘要
(200-300 字,通俗易懂地总结全文)

## 关键贡献
- 
- 
- 

## 方法与技术路线
(简要描述本文提出的核心方法、模型架构或算法)

## 主要实验结论
(简要列出实验结果、数据集表现或关键数据)

## 索引关键词
(提取 5-8 个便于在 Obsidian 中搜索的中英文关键词,用逗号分隔)

## 研究价值与应用场景
(简要分析本文在【{layer} / {category}】领域的应用价值)
"""
    try:
        text = call_llm(
            client,
            model=model,
            system="你是专业的 AI 与计算机科学领域研究员,擅长阅读英文论文并撰写高质量的中文总结笔记。",
            user=prompt,
            temperature=0.3,
            max_tokens=3000,
        )
        return text.strip()
    except Exception as e:
        print(f"    ❌ LLM 生成失败: {e}")
        return None
        return None


# ==================== 文件名清理 ====================
def sanitize_filename(name):
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    name = name.replace("\n", " ").replace("\r", "").strip()
    return name[:100]


def slug_tag(s: str) -> str:
    """Obsidian tag 不允许空格,用下划线替换。"""
    return re.sub(r"\s+", "_", s)


def update_matched_categories_in_md(md_path: str, matched_categories: list[str]) -> None:
    """
    幂等更新:把当前搜索命中的 matched_categories 写回已存在的 .md frontmatter。
    - 如果 frontmatter 没有 matched_categories 字段:加一行
    - 如果已有但缺新分类:补进去
    - 如果已有且完整包含:跳过
    """
    try:
        with open(md_path, "r", encoding="utf-8") as f:
            content = f.read()
    except OSError:
        return

    if not content.startswith("---"):
        return

    fm_end = content.find("\n---", 3)
    if fm_end < 0:
        return

    fm_block = content[3:fm_end]
    body = content[fm_end:]

    m = re.search(r"^matched_categories:\s*\[(.*?)\]\s*$", fm_block, re.MULTILINE)
    if m:
        existing_raw = m.group(1).strip()
        existing = [
            x.strip().strip('"').strip("'")
            for x in existing_raw.split(",")
            if x.strip()
        ] if existing_raw else []
        merged = list(dict.fromkeys(existing + list(matched_categories)))
        if merged == existing:
            return  # 没变化,不写
        new_value = ", ".join(merged)
        new_line = f"matched_categories: [{new_value}]"
        fm_block_new = re.sub(
            r"^matched_categories:\s*\[.*?\]\s*$",
            new_line, fm_block, count=1, flags=re.MULTILINE,
        )
    else:
        new_line = f"matched_categories: [{', '.join(matched_categories)}]"
        fm_block_new = fm_block.rstrip() + "\n" + new_line

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("---" + fm_block_new + body)


# ==================== 主流程 ====================
def run_daily_pipeline(layer: str | None = None, config: dict | None = None):
    cfg = config or DEFAULT_CONFIG
    vault_dir = cfg["vault_dir"]
    search_days = cfg["search_days"]
    max_per_query = cfg["max_results_per_query"]
    max_per_cat = cfg["max_papers_per_category"]
    threshold = cfg["quality_threshold"]
    scorer_model = cfg["quality_scorer_model"]
    summary_model = cfg["model"]

    if layer and layer not in SEARCH_CATEGORIES:
        print(f"❌ 未知层: {layer}")
        print(f"   可用层: {list(SEARCH_CATEGORIES.keys())}")
        sys.exit(1)

    layers = {layer: SEARCH_CATEGORIES[layer]} if layer else SEARCH_CATEGORIES

    # 构造共享的 LLM 客户端(MiniMax-M3 OpenAI 兼容)
    # 缺 API Key 时进入降级模式:只搜 + 下载 PDF,跳过评分与摘要
    no_llm_mode = False
    try:
        client = make_minimax_client(
            api_base=cfg["api_base"],
            api_key_env=cfg.get("api_key_env") or "MINIMAX_M3_API_KEY",
        )
    except Exception as e:
        print(f"⚠️  LLM 客户端初始化失败: {e}")
        print(f"💡 进入降级模式(no-LLM): 只下载 PDF,跳过评分与中文摘要")
        print(f"   修复方法: 设置环境变量 {cfg.get('api_key_env') or 'MINIMAX_M3_API_KEY'} 后重跑")
        client = None
        no_llm_mode = True
        # 降级模式下阈值不生效
        threshold = 0.0

    today = datetime.datetime.now().strftime("%Y-%m-%d")
    now_utc = datetime.datetime.now(datetime.timezone.utc)

    print(f"\n{'=' * 65}")
    print(f"🚀 arXiv to Obsidian — AI 论文周报收集器")
    print(f"📅 日期: {today}  |  层: {layer or 'ALL(全量回填)'}  |  窗口: {search_days} 天")
    print(f"🗂️   Vault: {vault_dir}")
    print(f"⭐ 评分阈值: {threshold}  (0 = 不过滤)")
    print(f"🤖 模型: {summary_model} @ {cfg['api_base']}")
    print(f"{'=' * 65}")

    os.makedirs(vault_dir, exist_ok=True)

    total_kept = 0
    total_rejected = 0
    total_downloaded = 0
    total_dedup_skipped = 0

    # ============ Pass 1: 全层 / 全分类扫描,以 arxiv_id 全局去重 ============
    # 一篇论文被多个分类的搜索词同时命中 → 只在首个分类落盘,
    # 其余命中分类写进 frontmatter 的 tags(matched_categories)。
    print("\n📥 Pass 1: 收集 + 全局去重...")

    # ---- 续跑缓存:同一天同一层跳过 arXiv 搜索(2026-07-23 加) ----
    # bash 后台任务被 30min 硬截,每轮都重新打 arXiv 会浪费 5-15min;
    # 把收集结果落到 logs/.arxiv_pass1_{layer}_{date}.json,续跑直接读。
    skill_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cache_dir = os.path.join(skill_root, "logs")
    cache_filename = f".arxiv_pass1_{layer or 'all'}_{today}.json"
    cache_path = os.path.join(cache_dir, cache_filename)
    collected: dict[str, dict] = {}
    cache_loaded = False
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cache_blob = json.load(f)
            if cache_blob.get("date") == today and cache_blob.get("layer") == (layer or "all"):
                collected = cache_blob.get("collected", {})
                cache_loaded = True
                print(f"  📂 命中 arXiv 搜索缓存: {len(collected)} 篇 ← {cache_filename}")
        except Exception as e:
            print(f"  ⚠️  缓存读取失败,回退到搜索: {e}")

    if not cache_loaded:
        for layer_name, categories in layers.items():
            cats = list(categories.items())
            for category, queries in cats:
                print(f"  🔍 [{layer_name}/{category}]")
                for q in queries:
                    try:
                        res = search_arxiv(q, max_results=max_per_query)
                    except Exception as e:
                        print(f"    ⚠️  搜索失败 [{q}]: {e}")
                        continue
                    for p in res:
                        pid = p["id"]
                        if pid not in collected:
                            collected[pid] = {
                                "paper": p,
                                "primary_layer": layer_name,
                                "primary_category": category,
                                "matched_layers": [layer_name],
                                "matched_categories": [category],
                            }
                        else:
                            entry = collected[pid]
                            if category not in entry["matched_categories"]:
                                entry["matched_categories"].append(category)
                            if layer_name not in entry["matched_layers"]:
                                entry["matched_layers"].append(layer_name)

        # 落盘缓存(供同日续跑使用)
        try:
            os.makedirs(cache_dir, exist_ok=True)
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(
                    {"date": today, "layer": layer or "all", "collected": collected},
                    f, ensure_ascii=False, indent=2,
                )
            print(f"  💾 arXiv 搜索缓存已落盘: {cache_filename} ({len(collected)} 篇)")
        except Exception as e:
            print(f"  ⚠️  缓存保存失败(不影响本次): {e}")

    # 时间窗过滤 + 排序
    fresh_papers = []
    for entry in collected.values():
        pub_dt = datetime.datetime.fromisoformat(
            entry["paper"]["published"].replace("Z", "+00:00")
        )
        if (now_utc - pub_dt).days < search_days:
            fresh_papers.append(entry)
    fresh_papers.sort(
        key=lambda e: e["paper"]["published"], reverse=True,
    )
    # 全层去重后,每层 per-category 不再截 top N(否则会丢跨分类的);
    # 总量按 (max_per_cat × 本层分类数) 截,保留重要信号
    layer_names = list(layers.keys())
    # 单层模式:按本层分类数截;全量模式:每层单独截后合并
    if len(layer_names) == 1:
        n_cats = sum(len(c) for c in layers[layer_names[0]].values())
        cap = max_per_cat * n_cats
        fresh_papers = fresh_papers[:cap]
    else:
        # 全量模式:按层分组,各取 max_per_cat × n_cats,再合并
        per_layer_caps = {
            ln: max_per_cat * sum(len(c) for c in layers[ln].values())
            for ln in layer_names
        }
        kept = []
        per_layer_count = {ln: 0 for ln in layer_names}
        for entry in fresh_papers:
            ln = entry["primary_layer"]
            if per_layer_count[ln] < per_layer_caps[ln]:
                kept.append(entry)
                per_layer_count[ln] += 1
        fresh_papers = kept

    # 真实去重收益:统计 collected 中各篇命中的 matched_categories 总和
    matched_total = sum(
        len(e["matched_categories"]) for e in collected.values()
    )
    saved_categories = matched_total - len(collected)

    print(f"\n  📊 去重后待处理: {len(fresh_papers)} 篇 "
          f"(arXiv 搜索去重后 {len(collected)} 篇,跨分类命中合计 "
          f"{matched_total} 次 → 节省 {saved_categories} 次冗余评估)")

    # ============ Pass 2: 按主分类写一次,matched 分类进 frontmatter tags ============
    print("\n📝 Pass 2: 评分 + 写笔记(每篇只写一次)...")
    rejected_by_layer_cat: dict[tuple[str, str], list] = {}

    for idx, entry in enumerate(fresh_papers, 1):
        paper = entry["paper"]
        primary_layer = entry["primary_layer"]
        primary_category = entry["primary_category"]
        matched_cats = entry["matched_categories"]
        matched_layers = entry["matched_layers"]

        cat_dir = os.path.join(vault_dir, primary_layer, primary_category)
        os.makedirs(cat_dir, exist_ok=True)

        safe_title = sanitize_filename(paper["title"])
        pdf_filename = f"{safe_title}.pdf"
        md_filename = f"{safe_title}.md"

        pdf_path = os.path.join(cat_dir, pdf_filename)
        md_path = os.path.join(cat_dir, md_filename)

        print(f"\n  [{idx}/{len(fresh_papers)}] {paper['title'][:58]}...")
        print(f"    🗂️  主分类: {primary_layer}/{primary_category}")
        if len(matched_cats) > 1:
            print(f"    🏷️  同时命中: {', '.join(matched_cats[1:])} "
                  f"→ 进 frontmatter tags")

        # 跨分类清理:无论主分类 PDF 是否已存在,都先把其它分类里
        # 同 arxiv_id 的旧 .md/.pdf 清掉(这些是上一版 pipeline 留下的重复)
        global_pdf_paths = []
        for layer_n in matched_layers:
            for cat_n in layers.get(layer_n, {}).keys():
                if (layer_n, cat_n) == (primary_layer, primary_category):
                    continue
                global_pdf_paths.append(
                    os.path.join(vault_dir, layer_n, cat_n, pdf_filename)
                )
        for stale_pdf in global_pdf_paths:
            stale_md = stale_pdf.replace(".pdf", ".md")
            for stale in (stale_pdf, stale_md):
                if os.path.exists(stale):
                    try:
                        os.remove(stale)
                        total_dedup_skipped += 1
                    except OSError:
                        pass

        if os.path.exists(pdf_path):
            print(f"    📄 PDF 已存在,跳过下载")
        else:
            print(f"    📥 下载 PDF...")
            if not download_pdf(paper["pdf_url"], pdf_path):
                continue
            total_downloaded += 1

        # md 已存在 → 跳过(下次 cron 会自动跳过)
        if os.path.exists(md_path):
            print(f"    📝 笔记已存在,跳过")
            # 但仍要把 matched_categories 更新到现有 frontmatter(幂等操作)
            update_matched_categories_in_md(md_path, matched_cats)
            continue

        # 提文本
        print(f"    📖 提取文本...")
        pdf_text = extract_pdf_text(pdf_path, max_pages=cfg["pdf_max_pages"])

        # ⭐ 评分
        if client is None:
            print(f"    ⭐ [no-LLM 模式] 跳过评分,直接保留")
            score = {
                "score": 7.0,
                "category": "no_llm",
                "reasons": ["LLM unavailable, kept by default"],
                "tl_dr": "(LLM 摘要不可用 — 请设置 MINIMAX_M3_API_KEY 后重跑以生成中文摘要)",
            }
        else:
            print(f"    ⭐ 评分...")
            score = score_paper(
                paper, primary_layer, primary_category, pdf_text,
                model=scorer_model, client=client,
            )
        bucket_emoji = (
            "🟢" if score["score"] >= 7
            else "🟡" if score["score"] >= 5
            else "🔴"
        )
        print(
            f"    {bucket_emoji} {score['score']:.1f}/10 "
            f"[{score['category']}]"
        )

        # 评分闸门
        if not should_keep(score["score"], threshold):
            reasons_str = "; ".join(score["reasons"][:2])
            print(f"    🚫 低于阈值 {threshold},跳过({reasons_str})")
            rej_key = (primary_layer, primary_category)
            rejected_by_layer_cat.setdefault(rej_key, []).append({
                **paper,
                "score": score["score"],
                "category": score["category"],
                "reasons": score["reasons"],
                "matched_categories": matched_cats,
            })
            total_rejected += 1
            continue

        # 中文摘要
        if client is None:
            print(f"    🤖 [no-LLM 模式] 跳过摘要生成")
            summary_content = (
                "## 摘要\n\n"
                "> ⚠️ **LLM 摘要暂不可用** — 本笔记由降级模式生成,只保留元信息 + PDF 链接。\n"
                "> 修复方法: 设置 `MINIMAX_M3_API_KEY` 环境变量后重跑流水线。\n\n"
                "### 论文元信息\n"
                f"- **arXiv ID**: {paper['id']}\n"
                f"- **作者**: {', '.join(paper['authors'])}\n"
                f"- **分类**: [{primary_layer} / {primary_category}]\n"
                f"- **发布时间**: {paper['published'][:10]}\n\n"
                "### 原文摘要(英文)\n"
                f"> {paper['summary'][:500]}{'...' if len(paper['summary']) > 500 else ''}\n"
            )
        else:
            print(f"    🤖 生成中文摘要...")
            summary_content = generate_summary(
                paper, primary_layer, primary_category, pdf_text,
                model=summary_model, client=client,
            )
            if not summary_content:
                summary_content = "摘要生成失败,请手动补充。"

        reasons_yaml = "\n".join(
            f'  - "{r}"' for r in score["reasons"][:3]
        ) or "  - \"\""

        # tags = matched_categories(全部命中分类) + quality 子标签
        cat_tags = ", ".join(slug_tag(c) for c in matched_cats)
        md_content = f"""---
title: "{paper['title']}"
authors: {', '.join(paper['authors'])}
date: {paper['published'][:10]}
arxiv_id: {paper['id']}
arxiv_url: {paper['url']}
layer: {primary_layer}
category: {primary_category}
matched_categories: [{', '.join(matched_cats)}]
tags: [arXiv, {cat_tags}, quality/{score['category']}]
quality_score: {score['score']}
quality_category: {score['category']}
quality_reasons:
{reasons_yaml}
pdf: "[[{pdf_filename}]]"
---

# {paper['title']}

> **TL;DR**: {score['tl_dr']}

**PDF**: [[{pdf_filename}]]  |  **质量分**: {score['score']:.1f}/10

{summary_content}
"""
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        print(f"    ✅ 笔记已生成: {md_filename}")
        total_kept += 1

    # 把被拒论文写留底
    for (layer_name, category), rejected_in_cat in rejected_by_layer_cat.items():
        rej_path = os.path.join(
            vault_dir, layer_name, category,
            f".rejected-{today}.json",
        )
        os.makedirs(os.path.dirname(rej_path), exist_ok=True)
        with open(rej_path, "w", encoding="utf-8") as f:
            json.dump(
                rejected_in_cat, f, ensure_ascii=False, indent=2,
            )
        print(f"\n  📋 被拒论文写入: {Path(rej_path).name} "
              f"({len(rejected_in_cat)} 篇)")

    print(f"\n{'=' * 65}")
    print(f"🎉 流水线完成")
    print(f"   📥 下载 PDF: {total_downloaded} 篇")
    print(f"   ⭐ 保留入库: {total_kept} 篇  (score ≥ {threshold})")
    print(f"   🚫 过滤: {total_rejected} 篇")
    print(f"   🧹 跨分类去重清理: {total_dedup_skipped} 个旧文件")
    print(f"   🗂️   Vault: {vault_dir}")
    print(f"{'=' * 65}")


# ==================== CLI ====================
def parse_args():
    p = argparse.ArgumentParser(
        description="arXiv to Obsidian 流水线"
    )
    p.add_argument(
        "--layer", default=None,
        help="只跑指定层(如 '第一层-专用小模型' 或别名 L1..L5); 缺省跑全部",
    )
    p.add_argument("--test", action="store_true",
                   help="测试模式: 第一层第一个分类")
    p.add_argument(
        "--config", default="config.yaml",
        help="配置文件路径(相对脚本目录)",
    )
    return p.parse_args()


def main():
    args = parse_args()
    cfg = load_config(args.config)

    # 别名解析:L1..L5 -> 中文层名(cron 调用时规避 unicode 风险)
    layer = args.layer
    if layer in LAYER_ALIAS:
        layer = LAYER_ALIAS[layer]

    if args.test:
        cfg["quality_threshold"] = 0  # 测试模式不过滤,确保有产出
        first_layer = next(iter(SEARCH_CATEGORIES))
        first_cat = next(iter(SEARCH_CATEGORIES[first_layer]))
        # 强制只跑该分类:临时改 SEARCH_CATEGORIES 结构
        sub = {first_cat: SEARCH_CATEGORIES[first_layer][first_cat]}
        # 用 monkey-patch 的方式只跑一组
        original = SEARCH_CATEGORIES[first_layer]
        SEARCH_CATEGORIES[first_layer] = sub
        try:
            run_daily_pipeline(layer=first_layer, config=cfg)
        finally:
            SEARCH_CATEGORIES[first_layer] = original
        return

    run_daily_pipeline(layer=layer, config=cfg)


if __name__ == "__main__":
    main()
