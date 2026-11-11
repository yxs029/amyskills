# 手工发布步骤（非 Windows / 无法执行 PowerShell 脚本时）

按顺序执行以下命令，效果等同于 `push_to_amyskills.ps1`。

## 0. 变量

```bash
SRC="/path/to/MySkills"                # 技能库源目录
STAGE="$HOME/amyskills-stage"          # 暂存仓库（保持固定=增量同步）
REPO="https://github.com/yxs029/amyskills.git"
BRANCH="main"
PROXY="http://127.0.0.1:7892"          # 可选；直连可用则留空
```

## 1. 上传前安全检查

```bash
grep -rEn "gk_live_[A-Za-z0-9]{8,}|ark-[A-Za-z0-9]{16,}|sk-[A-Za-z0-9]{20,}" \
  --include="*.md" --include="*.json" --include="*.py" --include="*.js" \
  --exclude-dir=.git "$SRC" | grep -v "你的\|xxx\|placeholder" || echo "clean"
```

发现真实 Key：先报告用户，脱敏或排除后再继续。

## 2. 大文件预检（GitHub 硬限制 100MB）

```bash
find "$SRC" -type f -size +100M    # 必须排除
find "$SRC" -type f -size +50M     # 50-100MB 可推但有警告
```

## 3. 暂存复制（排除垃圾与超限）

```bash
mkdir -p "$STAGE"
rsync -av \
  --exclude '__pycache__/' --exclude '.git/' --exclude 'node_modules/' \
  --exclude '.venv/' --exclude 'venv/' \
  --exclude '*.pyz' \
  --max-size=100M \
  "$SRC/" "$STAGE/"
```

注意 `--exclude '.git/'` 防止嵌套仓库变 submodule 引用。

## 4. git 初始化与提交

```bash
cd "$STAGE"
if [ ! -d .git ]; then
  git init -b "$BRANCH" 2>/dev/null || (git init && git checkout -b "$BRANCH")
  git remote add origin "$REPO"
fi
git config --local core.safecrlf false
git config --local user.name  "yxs029"
git config --local user.email "yxs029@users.noreply.github.com"
git add -A
git status --porcelain | grep -q . && git commit -m "chore: sync skills from $(basename "$SRC") ($(date +%F\ %R))"
```

## 5. README 技能清单（骨架自动生成）

```bash
if [ ! -f README.md ]; then
  {
    echo "# AmySkills - Skill Library"
    echo
    echo "| Skill | Description | Path |"
    echo "| --- | --- | --- |"
    find "$STAGE" -name SKILL.md -not -path "*/.git/*" | while read -r f; do
      name=$(awk '/^name:/{print $2; exit}' "$f")
      desc=$(awk '/^description:/{flag=1; next} flag && /^[^ \t]/{exit} flag{printf "%s ", $0}' "$f")
      rel=${f#"$STAGE"/}
      echo "| ${name:-?} | ${desc:0:180} | \`$rel\` |"
    done
  } > README.md
fi
```

（AI Agent 建议在骨架基础上人工润色：分类导航、安装说明、致谢来源。）

## 6. 推送（代理回退）与校验

```bash
push_try() { git -c http.proxy="$1" -c https.proxy="$1" push -u origin "$BRANCH" 2>&1; }

git push -u origin "$BRANCH" 2>&1 || push_try "$PROXY"   # 直连失败→代理

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git -c http.proxy="$PROXY" ls-remote origin "refs/heads/$BRANCH" | cut -f1)
[ "$LOCAL" = "$REMOTE" ] && echo "VERIFIED OK: $LOCAL" || echo "VERIFY FAILED"
```

无代理网络时去掉 `-c http.proxy=...` 部分。首次推送若需认证：有 GUI 用 Git Credential Manager 弹窗登录；无 GUI 用 PAT：`git remote set-url origin https://<user>:<PAT>@github.com/yxs029/amyskills.git`。

## 7. 判定

- robocopy/rsync 输出含复制记录 ≠ 失败；**一切以第 6 步 SHA 比对为准**。
- push 时 stderr 大量"错误"多为 PowerShell/进度噪音（Windows），同样以 SHA 为准。
