---
name: xlsx-to-docx
version: 1.0.0
description: |-
  Excel xlsx 文件（含图片）转换为 Word docx 文档
  支持多 Sheet、图片自动提取与位置锚定、rId 映射修正
metadata:
  openclaw:
    emoji: 📊
    category: file-convert
    tags:
      - xlsx
      - docx
      - excel
      - word
      - 图片
      - 转换
    requires:
      bins:
        - python3
      packages:
        - openpyxl
        - python-docx
---

# xlsx-to-docx Skill

> Excel xlsx（含图片）→ Word docx 专业转换工具

---

## 功能特性

- ✅ **多 Sheet 支持** - 自动读取 xlsx 所有 Sheet，保留表格结构
- ✅ **图片提取** - 从 Excel drawing XML 中提取所有内嵌图片
- ✅ **位置锚定** - 按单元格位置将图片插入 docx 对应位置
- ✅ **rId 映射修正** - 修复 drawing rels 中 rId4/rId5 对调等常见问题
- ✅ **格式保留** - 表格样式、数字格式基本保留
- ✅ **多图支持** - 单个 Sheet 可含多张图片，依次插入

---

## 依赖安装

```bash
# 安装依赖
pip install openpyxl python-docx

# 或通过 requirements.txt
echo "openpyxl>=3.1.0
python-docx>=1.1.0" > requirements.txt
pip install -r requirements.txt
```

---

## 快速使用

### 命令行

```bash
# 基本用法（输入输出自动命名）
python3 xlsx_to_docx.py input.xlsx

# 指定输出文件
python3 xlsx_to_docx.py input.xlsx output.docx

# 指定文档标题
python3 xlsx_to_docx.py input.xlsx output.docx "我的文档标题"

# 查看帮助
python3 xlsx_to_docx.py --help
```

### 在 Agent 工作流中调用

```python
import subprocess

result = subprocess.run(
    ['python3', 'xlsx_to_docx.py', '小样送货单方案.xlsx', '小样送货单方案.docx'],
    capture_output=True, text=True
)
print(result.stdout)
if result.returncode != 0:
    print(result.stderr)
```

---

## 工作原理

```
xlsx 文件结构
│
├── xl/
│   ├── workbook.xml          # Sheet 列表
│   ├── worksheets/
│   │   ├── sheet1.xml       # 单元格数据
│   │   └── ...
│   ├── drawings/
│   │   ├── drawing1.xml     # 图片锚点信息 (from/to行列)
│   │   └── _rels/drawing1.xml.rels  # rId -> 图片文件映射
│   ├── media/
│   │   ├── image1.png       # 实际图片数据
│   │   └── image2.jpeg
│   └── _rels/workbook.xml.rels  # Sheet <-> Drawing 关联
│
▼ 解析 ▼
│
1. 读取 workbook.xml → 获取所有 Sheet 名称
2. 读取每个 worksheet → 提取单元格文本/数值
3. 读取 drawings XML → 解析每个 anchor（from/to 行列）
4. 解析 rels → 建立 rId → 图片文件路径 映射
5. 从 xl/media/ 提取图片二进制数据
│
▼ 构建 ▼
│
docx
├── 标题（来自文件名或指定 title）
├── Sheet1 表格（保留行列结构）
│   └── 图片（按 anchor 行列插入）
├── Sheet2 表格
│   └── 图片
└── ...
```

---

## 图片位置锚定原理

Excel 中图片通过 `<anchor>` 元素定位：

```xml
<xdr:twoCellAnchor>
  <xdr:from>
    <xdr:col>2</xdr:col>   <!-- 起始列 (0-based) -->
    <xdr:row>5</xdr:row>   <!-- 起始行 (0-based) -->
  </xdr:from>
  <xdr:to>
    <xdr:col>6</xdr:col>    <!-- 结束列 -->
    <xdr:row>15</xdr:row>  <!-- 结束行 -->
  </xdr:to>
  <xdr:pic>
    <xdr:nvPicPr>
      <xdr:cNvPr name="图片 1" descr="说明文字"/>
    </xdr:nvPicPr>
    <a:blip r:embed="rId4"/>  <!-- 引用关系ID -->
  </xdr:pic>
</xdr:twoCellAnchor>
```

转换脚本将图片按 `from.row` 顺序插入 docx，确保图片出现在正确位置。

---

## rId 映射修正

### 常见问题

Excel 保存时可能出现 `drawing3.xml.rels` 中 rId4/rId5 对调：

```
<Relationships>
  <Relationship Id="rId4" Target="media/image5.png"/>  ← 实际是 image5
  <Relationship Id="rId5" Target="media/image4.png"/>  ← 实际是 image4
</Relationships>
```

### 解决方案

脚本通过两种方式双重校验：
1. **relationships 映射** - 从 rels 文件读取 Target 路径
2. **图片序号校验** - 根据 `media/image{N}.{ext}` 序号与 rId 交叉验证
3. **内容指纹** - 对重复文件做内容比对修正

---

## 输出格式

### 表格结构

- 按行列输出所有非空单元格
- 保留数字格式
- 表格样式：`Table Grid`（带边框）

### 图片格式

- 宽度最大 6.5 英寸（页面宽度）
- 按原始宽高比缩放
- 每张图片后自动添加空行
- 有描述时显示图说明

### 多 Sheet

- 如果只有 1 个 Sheet：直接输出内容
- 如果多个 Sheet：自动分页，每个 Sheet 以标题分隔

---

## 错误处理

| 错误类型 | 处理方式 | 影响 |
|---------|---------|------|
| rId 未找到 | 跳过该图片 | 单张图片丢失 |
| 图片数据为空 | 跳过 | 图片丢失 |
| Sheet 为空 | 跳过该 Sheet | 无输出 |
| 文件不存在 | 报错退出 | 转换失败 |
| xlsx 格式损坏 | 报错退出 | 转换失败 |

---

## 配置文件

无。纯命令行工具，参数全通过命令行传递。

---

## 示例输出

```
[INFO] 开始转换: 小样送货单方案.xlsx -> 小样送货单方案.docx
[INFO] 提取 Excel 图片...
[INFO] 共提取 11 张图片，分布在 1 个 Sheet
[INFO] 开始处理 1 个 Sheet...
[OK] 转换完成: 小样送货单方案.docx
     - Sheet 数: 1
     - 图片数: 11
```

---

## 文件结构

```
xlsx-to-docx/
├── SKILL.md               # 本文档
├── scripts/
│   └── xlsx_to_docx.py    # 主转换脚本
└── config/
    └── .gitkeep
└── references/            # 参考资料
    ├── 小样送货单方案&供应商扫码关联方案.xlsx    # 主参考文件（含11张图片）
    ├── 针对反应杯物料-扫码关联送货单方案---SRM提供202603.xlsx  # 辅助参考
    └── *.png               # Excel 内嵌图片样本
```

### 参考文件说明

| 文件 | 说明 | 用途 |
|------|------|------|
| `小样送货单方案&供应商扫码关联方案.xlsx` | 主参考，包含11张内嵌图片 | 验证图片提取、rId映射修正 |
| `针对反应杯物料-扫码关联送货单方案---SRM提供202603.xlsx` | 辅助参考 | 辅助验证多Sheet结构 |
| `*.png` (image1~11) | Excel 内嵌图片原始数据 | 验证EMU→像素计算、图片插入 |

**关键验证点（基于参考资料）：**
- drawing3.xml.rels 中 rId4/rId5 对调问题 ✅（已在参考资料中验证修正）
- 11张图片全部正确提取并插入docx ✅
- 图片说明文字（desc字段）正确获取 ✅
- EMU 尺寸计算：`cx/9144 = 像素` ✅

---

## 更新日志

- **v1.0.0** (2026-05-19): 初始版本
  - 多 Sheet 支持
  - 图片提取与位置锚定
  - rId 映射修正
  - 命令行接口
  - 参考资料收录

---

*服务袁总（老大）需求文档转换工作*
