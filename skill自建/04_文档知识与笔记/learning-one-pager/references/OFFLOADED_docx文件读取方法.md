## .docx文件读取方法

注意：execute_code sandbox没有python-docx模块，必须用terminal读取。

读取总段落数：
```bash
python3 -c "
from docx import Document
doc = Document('文件名.docx')
paras = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
print('总段落:', len(paras))
"
```

分块读取（python heredoc）：
```bash
python3 << 'EOF'
from docx import Document
doc = Document('文件名.docx')
paras = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
# 按需切片
for t in paras[0:50]:
    print(t)
EOF
```

**.docx vs .txt 读取策略**：
- 优先使用 `.txt` 文件学习（行数清晰，读取稳定）
- `.docx`文件（1080+段落）容易触发context overflow，必须分批读取（每批50段）
- 长.txt文件（>600行）分2-3批读取

---

**书籍学习方法论（2026-05-29新增）**

当雪松要求"每本书单独生成方法论和案例库"时，触发此流程：

**Step 1: 提取原文**
- 用 ZIP/XML 方法读取 .docx（不依赖 python-docx）：
  ```bash
  python3 << 'PYEOF'
  import zipfile, re, os
  with zipfile.ZipFile("document.docx") as z:
      with z.open('word/document.xml') as f:
          xml = f.read().decode('utf-8')
  text = re.sub(r'<w:br[^/]*/>', '\n', xml)
  text = re.sub(r'</w:p>', '\n', text)
  text = re.sub(r'<[^>]+>', '', text)
  text = re.sub(r'\n\s*\n', '\n', text).strip()
  with open("output.txt", 'w', encoding='utf-8') as f:
      f.write(text)
  PYEOF
  ```
- 复制到持久工作目录：`~/.hermes/tmp/books_work/`

**Step 2: 批量委托子代理**
- 每批最多 3 个并行任务（`delegate_task` 的 `max_concurrent_children=3`）
- 每个任务生成 2 个文件：`<书名>_方法论.md` + `<书名>_案例库.md`
- 任务 prompt 需包含：原文路径、输出路径、雪松场景（软件测试经理 + 个人品牌）
- API 超时会导致子代理 `max_iterations` 失败（书太大的 token 消耗），遇到这种情况直接重试或手动写

**Step 3: 合并结果**
- 检查输出目录，确认所有文件都已生成
- 缺失的文件（定位案例库曾因超时失败）手动补充
- 报告完成状态

**文件编码**：所有输出文件用 UTF-8（无 BOM），避免飞书渲染异常

---

> 📎 该章节已外置：[`references/OFFLOADED_常见错误及避免.md`](./references/OFFLOADED_常见错误及避免.md)（better-skill P1-4 引用库离线化）

