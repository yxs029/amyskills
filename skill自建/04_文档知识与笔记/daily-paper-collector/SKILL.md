---
title: "Skill-每日论文收集与白话解读-AutoClaw"
author: "Aaron雪松"
date: "2026-06-18"
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。

### 交付前自检（P1 · 挑刺审计）
交付前列出 3 个可能缺陷，至少修正 1 个，并复查受影响条目。


---
name: daily-paper-collector
description: 每日 arxiv 论文收集与白话解读。搜索 AI + 自主测试相关最新论文，以中文大白话（老奶奶能听懂）撰写摘要，存档到本地 memory/ 和得到大脑知识库。当用户需要"收集今天/昨天的论文""AI测试论文速递""arxiv论文白话解读"时调用本 skill。
---

# 每日论文收集与白话解读 Skill

> 从 arxiv 搜索 AI 与自主测试相关论文 → 白话解读 → 本地存档 + 得到大脑入库
> 作者风格：严谨不失有趣，老奶奶和小朋友都能听懂（小论 💪）

---

## ⚠️ Agent 必读

### 环境约束
- **无 `pip`**：只能使用 Python 3 标准库（`urllib`、`xml.etree.ElementTree`、`json`、`ssl`、`re`）
- **arxiv API 仅 HTTPS**：`http://export.arxiv.org` 会 301 重定向，直接用 `https://`
- **arxiv API 可能超时**：单次请求 timeout=30s，失败不 panic，换关键词重试
- **速率限制**：每次查询后 `time.sleep(3)`

### 🔑 凭证
从 `workspace/.env` 读取：
- `GETNOTE_API_KEY`（格式：`gk_live_xxx`）
- `GETNOTE_CLIENT_ID`（格式：`cli_xxx`）

### 📚 得到大脑配置
- Base URL: `https://openapi.biji.com`
- 目标知识库：`04 软件测试开发技术收集`（topic_id: `LYwzdeGn`）
- 标题格式：`YYYYMMDD-AI和自主测试论文列-AutoClaw`

---

## 执行流程

### 第一步：确定目标日期

```bash
date -d 'yesterday' +%Y%m%d  # Linux
date -v-1d +%Y%m%d           # macOS
```

默认搜索**前一天**（昨天）。当天论文太少（<3篇），自动扩展到前2-3天。

---

### 第二步：搜索论文

**两轮搜索策略：**

**第一轮（宽搜）：跨全分类**
```python
queries_wide = [
    'all:"autonomous testing"',
    'all:"AI testing" AND all:software',
    'all:"LLM test generation"',
    'all:"software test automation"',
    'all:"test oracle" AND all:software',
    'all:"large language model" AND all:testing AND all:software',
    'all:"automated test generation" AND all:AI',
    'all:"fuzzing" AND all:AI',
    'all:"AI agent" AND all:testing',
    'all:"machine learning" AND all:"software testing"',
]
```

**第二轮（精搜）：限定 cs.SE**
```python
queries_narrow = [
    'cat:cs.SE',
    'cat:cs.SE AND all:test',
    'cat:cs.SE AND all:LLM',
    'cat:cs.SE AND all:agent',
    'cat:cs.SE AND all:"vulnerability"',
    'cat:cs.SE AND all:"code review"',
    'cat:cs.SE AND all:"automated" AND all:repair',
]
```

**核心搜索函数：**

```python
import urllib.request, urllib.parse, ssl, time, xml.etree.ElementTree as ET

BASE_URL = "https://export.arxiv.org/api/query"
ctx = ssl.create_default_context()

def search_arxiv(query, max_results=30):
    params = {
        'search_query': query,
        'start': 0, 'max_results': max_results,
        'sortBy': 'submittedDate', 'sortOrder': 'descending'
    }
    url = BASE_URL + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': 'PaperCollector/1.0'})
    with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
        data = resp.read().decode('utf-8')
    
    root = ET.fromstring(data)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    papers = []
    for entry in root.findall('atom:entry', ns):
        eid = entry.find('atom:id', ns)
        arxiv_id = eid.text.strip().split('/abs/')[-1] if eid is not None else ''
        title = entry.find('atom:title', ns)
        title = title.text.strip().replace('\n', ' ') if title is not None else ''
        summary = entry.find('atom:summary', ns)
        summary = summary.text.strip().replace('\n', ' ') if summary is not None else ''
        pub = entry.find('atom:published', ns)
        upd = entry.find('atom:updated', ns)
        authors = [a.find('atom:name', ns).text.strip() 
                   for a in entry.findall('atom:author', ns) 
                   if a.find('atom:name', ns) is not None]
        link = ''
        for l in entry.findall('atom:link', ns):
            if l.get('type') == 'text/html':
                link = l.get('href', '')
        papers.append({
            'id': arxiv_id,
            'title': title,
            'authors': authors,
            'summary': summary,
            'published': pub.text.strip() if pub is not None else '',
            'updated': upd.text.strip() if upd is not None else '',
            'link': link
        })
    return papers

# 循环查询、去重
all_papers = {}
for query in queries_wide + queries_narrow:
    try:
        for p in search_arxiv(query):
            if p['id'] not in all_papers:
                all_papers[p['id']] = p
        time.sleep(3)
    except Exception as e:
        print(f"Query failed: {query[:60]} → {e}")
```

---

### 第三步：筛选论文

**日期过滤 + 相关性打分：**

```python
test_kw = ['test', 'testing', 'fuzz', 'oracle', 'bug', 'vulnerability',
           'mutation', 'verification', 'validation', 'debug', 'repair',
           'code review', 'quality', 'coverage', 'specification', 'agent',
           'LLM', 'language model', 'autonomous', 'AI']

def score(p):
    tl = p['title'].lower()
    sl = p['summary'].lower()[:500]
    return sum(3 for kw in test_kw if kw in tl) + sum(1 for kw in test_kw if kw in sl)

target = '2026-06-17'  # 前一天
recent = [p for p in all_papers.values() if p['updated'][:10] >= target]
recent.sort(key=lambda x: x['updated'], reverse=True)

# 取 top 8-12 篇
selected = [p for p in recent if score(p) >= 5][:12]
```

---

### 第四步：写白话摘要

**每条摘要规范：**
- 约 200 字中文
- 风格：严谨不失有趣，讲给老奶奶能听懂
- 结构：场景引入 → 核心方法 → 关键发现 → 一句启发
- 避免直接翻译摘要，用比喻和日常类比
- 每条附 arxiv 链接：`https://arxiv.org/abs/XXXX.XXXXX`
- 论文标题保留英文原题

**风格参考：**
```
想象一下，你让一个AI帮你写测试代码。它洋洋洒洒写了一堆，跑起来一片绿色通过✅。
但你有没有想过——这些测试真的在检验什么吗？
这篇论文扒了五个主流AI编程助手生成的86,156个测试文件...
```

---

### 第五步：本地存档

**路径：** `memory/YYYYMMDD-paper.md`

**Markdown 模板（关键结构）：**
```markdown
# YYYY年M月D日 — AI与自主测试论文速递

> 论文收录日期：YYYY-MM-DD ~ YYYY-MM-DD
> 整理时间：YYYY-MM-DD HH:MM CST | 整理者：小论 💪

---

## 📌 今日亮点：[一句话亮点]

---

## 1. 🔥 [Title]
**链接：** https://arxiv.org/abs/XXXX.XXXXX
**日期：** YYYY-MM-DD | **作者：** Author1, Author2

**💬 大白话解读：**
[约200字中文解读]

---

## 📊 统计小结
[表格]

## 🏷️ 主题聚类
[分类汇总]
```

---

### 第六步：存入得到大脑

**两步 API：**

```python
import json, urllib.request, ssl, re

API_KEY = "从.env读取"  # gk_live_xxx
CLIENT_ID = "从.env读取"  # cli_xxx
BASE = "https://openapi.biji.com"
TOPIC_ID = "LYwzdeGn"
ctx = ssl.create_default_context()

def api(endpoint, data):
    body = json.dumps(data, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(f"{BASE}{endpoint}", data=body, method='POST',
        headers={'Authorization': API_KEY, 'X-Client-ID': CLIENT_ID, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
        raw = r.read().decode('utf-8')
        raw = re.sub(r'"id":(\d{10,})', r'"id":"\1"', raw)  # ⚠️ 防 int64 精度丢失
        return json.loads(raw)

# Step 1: 保存笔记
with open(f'memory/{date_str}-paper.md') as f:
    content = f.read()

r = api("/open/api/v1/resource/note/save", {
    "title": f"{date_str}-AI和自主测试论文列-AutoClaw",
    "content": content,
    "content_type": "markdown"
})

if r.get('success'):
    note_id = r['data']['id']
    # Step 2: 加入知识库
    r2 = api("/open/api/v1/resource/knowledge/note/batch-add", {
        "topic_id": TOPIC_ID,
        "note_ids": [note_id]
    })
    print("✅ 入库成功" if r2.get('success') else f"❌ {r2}")
```

**⚠️ 关键注意：**
- 必须用正则 `"id":(\d{10,})` → `"id":"\1"` 防止 int64 溢出
- 返回结构：`{"success": true, "data": {"id": "..."}}`（不是 `code: 0`）
- 禁止编造 note_id、伪造响应

---

### 第七步：清理临时文件

```bash
rm -f arxiv_search*.py papers_*.json upload_note.py add_to_kb.py
```

---

## 扩展方向

- 🔗 Papers With Code 获取 GitHub 实现
- 📊 Semantic Scholar 引用数/影响力
- 🏷️ 自动打主题标签
- 📮 飞书/钉钉推送亮点
