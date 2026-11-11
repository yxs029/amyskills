// src/adapters/deepseek-harness/plugin.ts
import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";

// src/core/tools/lifecycle.ts
import path5 from "path";
import { createHash as createHash2 } from "node:crypto";
import { copyFile, mkdir, readdir, readFile as readFile4, rmdir, rm as rm2 } from "node:fs/promises";

// src/core/types.ts
var CODE_DIMENSIONS = ["style", "architecture", "performance", "security", "maintainability"];
var REVIEW_DIMENSIONS = [...CODE_DIMENSIONS];
var BUILD_PHASE_TARGETS = ["task_analysis", "dev_impl", "review"];
var REVIEW_LAYERS = ["tool", "task", "quality"];
var REVIEW_VERIFY_STEPS = ["verify_tool", "verify_task", "verify_quality"];
var SIMPLE_REVIEW_STEPS = ["quality_review"];
var REVIEW_TASK_GROUP_ID = "review";

// src/core/constants.ts
var STATE_DIR_NAME = "openspec";
var STATE_SUBDIR_NAME = "states";
var LEGACY_STATE_DIR_NAME = ".opencode";
var LEGACY_STATE_SUBDIR_NAME = ".orchestrate_state";
var SEVERITY_LEVELS = ["Critical", "High", "Medium", "Low", "Info"];
var BLOCKING_SEVERITIES = ["Critical", "High", "Medium", "Low"];
var DIMENSION_AGENT_MAP = {
  style: "openspec-reviewer-style",
  architecture: "openspec-reviewer-architecture",
  performance: "openspec-reviewer-performance",
  security: "openspec-reviewer-security",
  maintainability: "openspec-reviewer-maintainability"
};
function agentToReviewDimension(agent) {
  return Object.keys(DIMENSION_AGENT_MAP).find((d) => DIMENSION_AGENT_MAP[d] === agent);
}
function agentToReviewLayer(agent) {
  if (!agent)
    return;
  if (agent === "openspec-reviewer-tool")
    return "tool";
  if (agent === "openspec-reviewer-task")
    return "task";
  if (agent === "openspec-reviewer")
    return "quality";
  if (agentToReviewDimension(agent))
    return "quality";
  return;
}
function isReviewerFamily(agent) {
  return agent === "openspec-architect" || agentToReviewLayer(agent) !== undefined;
}
function readIssueSource(child) {
  return typeof child.metadata["source"] === "string" ? child.metadata["source"] : undefined;
}
function reviewLayerFromMetadata(child) {
  const source = readIssueSource(child);
  const bySource = agentToReviewLayer(source);
  if (bySource)
    return bySource;
  const rawPhase = child.metadata["source_phase"];
  return rawPhase === "tool" || rawPhase === "task" || rawPhase === "quality" ? rawPhase : "tool";
}

// src/core/git.ts
import path from "path";
import { execFile } from "node:child_process";
import { readFile, writeFile, stat, rm, realpath } from "node:fs/promises";
async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
function execGit(args) {
  return new Promise((resolve) => {
    const child = execFile("git", args, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout || "",
        stderr: stderr || "",
        exitCode: err ? err.code || 1 : 0
      });
    });
  });
}
var defaultRunner = {
  async run(worktree, args) {
    try {
      const { stdout } = await execGit(["-C", worktree, ...args]);
      return stdout.trim();
    } catch {
      return "";
    }
  },
  async runChecked(worktree, args) {
    const { stdout, stderr, exitCode } = await execGit(["-C", worktree, ...args]);
    return { success: exitCode === 0, stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
  }
};
var gitRunner = defaultRunner;
async function runGit(worktree, args) {
  return gitRunner.run(worktree, args);
}
async function runGitChecked(worktree, args) {
  return gitRunner.runChecked(worktree, args);
}
async function removeTaskGroupWorktree(repoRoot, wtPath, opts = {}) {
  const result = { dirResolved: false, dirResolvedByFallback: false, pruned: false, branchDeleted: null, errors: [] };
  if (!await pathExists(wtPath)) {
    const pruneRes = await runGitChecked(repoRoot, ["worktree", "prune"]);
    if (pruneRes.success)
      result.pruned = true;
    else
      result.errors.push(`worktree prune 失败：${pruneRes.stderr}`);
    result.dirResolved = true;
  } else {
    const rmRes = await runGitChecked(repoRoot, ["worktree", "remove", wtPath, "--force"]);
    if (!rmRes.success)
      result.errors.push(`git worktree remove 失败：${rmRes.stderr}`);
    if (await pathExists(wtPath)) {
      try {
        await rm(wtPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      } catch (e) {
        result.errors.push(`文件系统兜底删除 "${wtPath}" 失败：${e instanceof Error ? e.message : String(e)}`);
      }
      const pruneRes = await runGitChecked(repoRoot, ["worktree", "prune"]);
      if (pruneRes.success)
        result.pruned = true;
      else
        result.errors.push(`worktree prune 失败：${pruneRes.stderr}`);
      if (!await pathExists(wtPath)) {
        result.dirResolved = true;
        result.dirResolvedByFallback = true;
      }
    } else {
      result.dirResolved = true;
    }
  }
  if (!result.dirResolved) {
    if (opts.branchName) {
      result.errors.push(`目录 "${wtPath}" 未能删除，跳过分支 "${opts.branchName}" 的删除以保留排查线索`);
    }
    return result;
  }
  if (opts.branchName) {
    const branchRes = await runGitChecked(repoRoot, ["branch", "-D", opts.branchName]);
    if (branchRes.success)
      result.branchDeleted = true;
    else {
      result.branchDeleted = false;
      result.errors.push(`删除分支 "${opts.branchName}" 失败：${branchRes.stderr}`);
    }
  }
  return result;
}
async function getCurrentHead(worktree) {
  return runGit(worktree, ["rev-parse", "HEAD"]);
}
async function getCurrentBranch(worktree) {
  const branch = (await runGit(worktree, ["rev-parse", "--abbrev-ref", "HEAD"])).trim();
  if (branch === "HEAD")
    throw new Error("当前处于 detached HEAD 状态，无法自动推断 base_branch。请显式传入 base_branch 参数。");
  return branch;
}
async function getMergeBase(worktree, baseBranch) {
  return runGit(worktree, ["merge-base", "HEAD", baseBranch]);
}
async function isAncestor(worktree, a, b) {
  const r = await runGitChecked(worktree, ["merge-base", "--is-ancestor", a, b]);
  if (r.success)
    return true;
  if (r.exitCode === 1)
    return false;
  throw new Error(`无法判断 "${a}" 是否为 "${b}" 的祖先：${r.stderr}`);
}
async function listBranchDriftFiles(worktree, sourceBranch, targetBranch) {
  const r = await runGitChecked(worktree, ["diff", "--name-only", "--no-renames", `${sourceBranch}...${targetBranch}`]);
  if (!r.success)
    return null;
  return parseDiffNameOnly(r.stdout);
}
async function isVersionOnlyDrift(worktree, sourceBranch, targetBranch, filePath) {
  const r = await runGitChecked(worktree, ["diff", "--no-renames", `${sourceBranch}...${targetBranch}`, "--", filePath]);
  if (!r.success)
    return null;
  for (const line of r.stdout.split(`
`)) {
    if (line.startsWith("+++") || line.startsWith("---"))
      continue;
    if ((line.startsWith("+") || line.startsWith("-")) && !/^[+-]\s*"version"\s*:/.test(line))
      return false;
  }
  return true;
}
async function isLocalBranch(worktree, branch) {
  const r = await runGitChecked(worktree, ["rev-parse", "--verify", `refs/heads/${branch}`]);
  return r.success;
}
async function listLocalBranches(worktree) {
  const out = await runGit(worktree, ["for-each-ref", "--format=%(refname:short)", "refs/heads"]);
  return out.split(`
`).map((l) => l.trim()).filter(Boolean);
}
async function blobOidInRef(worktree, ref, relPath) {
  const r = await runGitChecked(worktree, ["rev-parse", `${ref}:${relPath}`]);
  if (!r.success)
    throw new Error(`无法读取 ${ref}:${relPath} 的版本库对象：${r.stderr}`);
  return r.stdout;
}
async function hashObjectOfFile(worktree, filePath) {
  const r = await runGitChecked(worktree, ["hash-object", filePath]);
  if (!r.success)
    throw new Error(`无法计算 "${filePath}" 的内容哈希：${r.stderr}`);
  return r.stdout;
}
async function listTreePaths(worktree, rev, dirPath) {
  const r = await runGitChecked(worktree, ["ls-tree", "-r", "--name-only", rev, "--", dirPath]);
  if (!r.success)
    throw new Error(`无法读取 ${rev} 下 "${dirPath}" 的版本库内容：${r.stderr}`);
  return r.stdout.split(`
`).map((l) => l.trim()).filter(Boolean);
}
async function isWorktreeClean(worktree) {
  const out = await runGit(worktree, ["status", "--porcelain"]);
  return out.length === 0;
}
function isDocLikePath(p) {
  return p.startsWith("openspec/") || /\.md$/i.test(p);
}
async function listDirtyNonDocFiles(worktree) {
  const res = await runGitChecked(worktree, ["status", "--porcelain", "-uall"]);
  if (!res.success)
    return [];
  const seen = new Set;
  const files = [];
  for (const entry of parseStatusEntries(res.stdout)) {
    for (const p of entry.paths) {
      if (!p)
        continue;
      if (p.startsWith("openspec/states/"))
        continue;
      if (isDocLikePath(p))
        continue;
      if (seen.has(p))
        continue;
      seen.add(p);
      files.push(p);
    }
  }
  return files;
}
async function markTaskGroupCheckboxesComplete(worktree, changeId, taskGroupId) {
  const tasksMdPath = path.join(worktree, "openspec", "changes", changeId, "tasks.md");
  let content;
  try {
    content = await readFile(tasksMdPath, "utf-8");
  } catch {
    return;
  }
  const lines = content.split(`
`);
  let inGroup = false;
  let modified = false;
  const result = [];
  for (const line of lines) {
    const groupMatch = line.match(/^##\s+(\d+)\./);
    if (groupMatch) {
      inGroup = groupMatch[1] === taskGroupId;
      result.push(line);
      continue;
    }
    if (inGroup && /^-\s+\[\s\]\s+/.test(line)) {
      result.push(line.replace(/^(-\s+)\[\s\](\s+)/, "$1[x]$2"));
      modified = true;
    } else {
      result.push(line);
    }
  }
  if (!modified)
    return;
  await writeFile(tasksMdPath, result.join(`
`));
  const addResult = await runGitChecked(worktree, ["add", tasksMdPath]);
  if (!addResult.success) {
    throw new Error(`git add tasks.md 失败：${addResult.stderr}`);
  }
  const commitResult = await runGitChecked(worktree, ["commit", "-m", "docs(tasks): mark completed task checkboxes"]);
  if (!commitResult.success) {
    throw new Error(`git commit tasks.md 失败：${commitResult.stderr}`);
  }
}
function unquotePath(p) {
  const t = p.trim();
  return t.startsWith('"') && t.endsWith('"') && t.length >= 2 ? t.slice(1, -1) : t;
}
function parseStatusEntries(out) {
  const entries = [];
  for (const raw of out.split(`
`)) {
    if (raw.length < 4)
      continue;
    let line = raw;
    if (line[2] !== " ") {
      if (line[1] !== " ")
        continue;
      line = ` ${line}`;
    }
    if (line[0] === " " && line[1] === " ")
      continue;
    const pathPart = line.slice(3);
    const arrow = pathPart.indexOf(" -> ");
    const paths = arrow >= 0 ? [unquotePath(pathPart.slice(0, arrow)), unquotePath(pathPart.slice(arrow + 4))] : [unquotePath(pathPart)];
    if (paths.every((p) => p !== ""))
      entries.push({ x: line[0], y: line[1], paths });
  }
  return entries;
}
function parseDiffNameOnly(out) {
  return out.split(`
`).map(unquotePath).filter(Boolean);
}
function pathsOverlap(a, b) {
  const na = a.replace(/\/+$/, "");
  const nb = b.replace(/\/+$/, "");
  if (!na || !nb)
    return false;
  if (na === nb)
    return true;
  return na.startsWith(`${nb}/`) || nb.startsWith(`${na}/`);
}
async function mergeBranchToTarget(repoDir, sourceBranch, targetBranch) {
  const mainRepo = await resolveMainRepoRoot(repoDir) ?? repoDir;
  const ancestor = await runGitChecked(mainRepo, ["merge-base", "--is-ancestor", sourceBranch, targetBranch]);
  if (ancestor.success)
    return { success: true, conflict: false };
  if (ancestor.exitCode !== 1) {
    throw new Error(`无法判断 "${sourceBranch}" 是否已并入 "${targetBranch}"：${ancestor.stderr}`);
  }
  const checkedOutPath = await findWorktreeCheckingOut(mainRepo, targetBranch);
  if (checkedOutPath) {
    if (!await sameDir(checkedOutPath, mainRepo)) {
      return {
        success: false,
        conflict: false,
        blockedMessage: [
          `- **原因**: 目标分支 \`${targetBranch}\` 正被工作树 \`${checkedOutPath}\` 检出；自动推进分支指针会使该工作树的暂存区/工作区与分支引用失步，本次未执行任何合并动作。`,
          `- **处理**: 请在该工作树手动执行 \`git merge ${sourceBranch}\`，或移除该工作树（\`git worktree remove ${checkedOutPath}\`）后重试。`
        ].join(`
`)
      };
    }
    const mergeTree2 = await runGitChecked(mainRepo, ["merge-tree", "--write-tree", "--messages", targetBranch, sourceBranch]);
    if (!mergeTree2.success) {
      if (mergeTree2.exitCode !== 1) {
        throw new Error(`无法试算 "${sourceBranch}" → "${targetBranch}" 的合并：${mergeTree2.stderr}`);
      }
      return { success: false, conflict: true };
    }
    const mergedTreeOid = mergeTree2.stdout.split(`
`)[0].trim();
    const statusRes = await runGitChecked(mainRepo, ["status", "--porcelain"]);
    if (!statusRes.success) {
      throw new Error(`无法读取主仓库工作区状态：${statusRes.stderr}`);
    }
    const entries = parseStatusEntries(statusRes.stdout);
    if (entries.length > 0) {
      const dirtyPaths = [...new Set(entries.flatMap((e) => e.paths))];
      const written = parseDiffNameOnly(await runGit(mainRepo, ["diff", "--name-only", "--no-renames", targetBranch, mergedTreeOid]));
      const overlap = written.filter((w) => dirtyPaths.some((d) => pathsOverlap(d, w)));
      if (overlap.length > 0) {
        return {
          success: false,
          conflict: false,
          blockedMessage: [
            `- **原因**: 目标分支 \`${targetBranch}\` 正被主仓库检出，且以下本地改动文件与变更分支合并将写入的文件重合；为避免覆盖本地改动，本次未执行任何合并动作（分支引用未动、无半成品）：`,
            ...overlap.map((f) => `  - \`${f}\``),
            `- **处理**: 请先 commit/stash/移除上述文件的本地改动后重试；或自行执行 \`git merge ${sourceBranch}\`（真实合并自带脏工作区保护）。`
          ].join(`
`)
        };
      }
      const stagedPaths = [...new Set(entries.filter((e) => e.x !== " " && e.x !== "?").flatMap((e) => e.paths))];
      if (stagedPaths.length > 0) {
        const unstagedDelta = await runGit(mainRepo, ["diff", "--name-only", "--", ...stagedPaths]);
        if (parseDiffNameOnly(unstagedDelta).length > 0) {
          return {
            success: false,
            conflict: false,
            blockedMessage: [
              `- **原因**: 主仓库存在部分暂存文件（同一文件既有已暂存又有未暂存改动），自动合并会改变暂存粒度；本次未执行任何合并动作（分支引用未动、无半成品）。`,
              `- **处理**: 请先 commit 或 stash，或补全/取消暂存后重试；或自行执行 \`git merge ${sourceBranch}\`。`
            ].join(`
`)
          };
        }
        let unstagedByUs = false;
        try {
          const restore = await runGitChecked(mainRepo, ["restore", "--staged", "--", ...stagedPaths]);
          if (!restore.success)
            throw new Error(`git restore --staged 失败（未执行合并）：${restore.stderr}`);
          unstagedByUs = true;
          const mergeResult2 = await runGitChecked(mainRepo, ["merge", "--no-ff", sourceBranch]);
          if (!mergeResult2.success) {
            await runGitChecked(mainRepo, ["merge", "--abort"]);
            return { success: false, conflict: true };
          }
          return { success: true, conflict: false };
        } finally {
          if (unstagedByUs) {
            const readd = await runGitChecked(mainRepo, ["add", "--", ...stagedPaths]);
            if (!readd.success) {
              throw new Error(`合并后还原暂存态失败（git add）：${readd.stderr}；请人工核对这些文件的暂存状态`);
            }
          }
        }
      }
    }
    const mergeResult = await runGitChecked(mainRepo, ["merge", "--no-ff", sourceBranch]);
    if (!mergeResult.success) {
      await runGitChecked(mainRepo, ["merge", "--abort"]);
      return { success: false, conflict: true };
    }
    return { success: true, conflict: false };
  }
  const mergeTree = await runGitChecked(mainRepo, ["merge-tree", "--write-tree", "--messages", targetBranch, sourceBranch]);
  if (!mergeTree.success) {
    if (mergeTree.exitCode !== 1) {
      throw new Error(`无法试算 "${sourceBranch}" → "${targetBranch}" 的合并：${mergeTree.stderr}`);
    }
    return { success: false, conflict: true };
  }
  const treeOid = mergeTree.stdout.split(`
`)[0].trim();
  if (!treeOid)
    throw new Error("merge-tree 未返回树对象，无法生成合并提交。");
  const targetOid = (await runGit(mainRepo, ["rev-parse", targetBranch])).trim();
  const sourceOid = (await runGit(mainRepo, ["rev-parse", sourceBranch])).trim();
  if (!targetOid || !sourceOid) {
    throw new Error(`无法解析分支 OID：target="${targetOid}" source="${sourceOid}"`);
  }
  const commitOid = (await runGit(mainRepo, [
    "commit-tree",
    treeOid,
    "-p",
    targetOid,
    "-p",
    sourceOid,
    "-m",
    `Merge branch '${sourceBranch}'`
  ])).trim();
  if (!commitOid)
    throw new Error("git commit-tree 失败：无法创建合并提交。");
  const updateRef = await runGitChecked(mainRepo, ["update-ref", `refs/heads/${targetBranch}`, commitOid, targetOid]);
  if (!updateRef.success) {
    throw new Error(`基础分支 "${targetBranch}" 已被并发推进，合并提交未写入（update-ref 旧值校验失败）：${updateRef.stderr}`);
  }
  return { success: true, conflict: false };
}
var RESTORABLE_WORKTREE_BRANCH_PREFIXES = ["change/", "review/", "task-group/"];
async function discoverDiskWorktrees(worktree) {
  const result = [];
  const wtList = await runGit(worktree, ["worktree", "list"]);
  for (const line of wtList.split(`
`)) {
    const m = line.match(/^(\S+)\s+[0-9a-f]+\s+\[(.+?)\]/);
    if (m) {
      const branch = m[2].trim();
      if (RESTORABLE_WORKTREE_BRANCH_PREFIXES.some((p) => branch.startsWith(p))) {
        result.push({ branch, path: m[1].trim() });
      }
    }
  }
  return result;
}
async function discoverRepoRoot(worktreePath) {
  const gitFile = path.join(worktreePath, ".git");
  let content;
  try {
    content = await readFile(gitFile, "utf-8");
  } catch {
    throw new Error(`无法读取 ${gitFile}，请确认该路径是一个有效的 git worktree。`);
  }
  const match = content.match(/^gitdir:\s*(.+)$/m);
  if (!match) {
    throw new Error(`无法从 ${gitFile} 解析 gitdir 行。文件内容：${content.slice(0, 200)}`);
  }
  const gitdir = match[1].trim();
  const idx = gitdir.indexOf("/.git/worktrees/");
  if (idx === -1) {
    throw new Error(`无法从 gitdir "${gitdir}" 推导主仓库路径，缺少 "/.git/worktrees/" 标记。`);
  }
  return gitdir.slice(0, idx);
}
function parsePorcelainPaths(out) {
  const lines = out.split(`
`).map((l) => l.trim()).filter(Boolean);
  return lines.map((l) => {
    let f = l.replace(/^\S+\s+/, "");
    if (f.includes(" -> "))
      f = f.split(" -> ").pop().trim();
    return f.replace(/^"+|"+$/g, "");
  });
}
async function resolveMainRepoRoot(worktreePath) {
  try {
    const st = await stat(path.join(worktreePath, ".git"));
    return st.isDirectory() ? worktreePath : await discoverRepoRoot(worktreePath);
  } catch {
    return null;
  }
}
async function sameDir(a, b) {
  try {
    return await realpath(a) === await realpath(b);
  } catch {
    return path.resolve(a) === path.resolve(b);
  }
}
async function findWorktreeCheckingOut(repoRoot, branch) {
  const out = await runGit(repoRoot, ["worktree", "list", "--porcelain"]);
  for (const block of out.split(`

`)) {
    let wtPath = "";
    let wtBranch = "";
    for (const line of block.split(`
`)) {
      if (line.startsWith("worktree "))
        wtPath = line.slice("worktree ".length).trim();
      else if (line.startsWith("branch "))
        wtBranch = line.slice("branch ".length).trim();
    }
    if (wtPath && wtBranch === `refs/heads/${branch}`)
      return wtPath;
  }
  return null;
}
async function detectMainRepoPollution(worktreePath) {
  const repoRoot = await resolveMainRepoRoot(worktreePath);
  if (!repoRoot)
    return null;
  let out;
  try {
    out = await runGit(repoRoot, ["status", "--porcelain", "--", "openspec/"]);
  } catch {
    return null;
  }
  const files = parsePorcelainPaths(out);
  if (files.length === 0)
    return null;
  return { repoRoot, files };
}
async function detectChanges(worktreePath, opts) {
  if (opts.scopeFull)
    return { files: [], hasNonDocChange: false, scopeFull: true };
  const files = [];
  let gitFailed = false;
  const range = opts.checkpoint || opts.baseRef || undefined;
  if (range) {
    try {
      const res = await runGitChecked(worktreePath, ["diff", "--name-only", `${range}..HEAD`]);
      if (res.success) {
        for (const line of res.stdout.split(`
`)) {
          const f = line.trim();
          if (f)
            files.push(f);
        }
      } else {
        gitFailed = true;
      }
    } catch {
      gitFailed = true;
    }
  } else {
    gitFailed = true;
  }
  const uncommitted = [];
  try {
    const res = await runGitChecked(worktreePath, ["status", "--porcelain"]);
    if (res.success) {
      for (const f of parsePorcelainPaths(res.stdout)) {
        if (!f.startsWith("openspec/"))
          uncommitted.push(f);
      }
    } else {
      gitFailed = true;
    }
  } catch {
    gitFailed = true;
  }
  const all = [...files, ...uncommitted];
  const hasNonDocChange = gitFailed || all.some((f) => !f.startsWith("openspec/"));
  return { files: all, hasNonDocChange };
}
async function reconcileMainPollution(mainRepo, worktreePath, opts) {
  const changeDir = `openspec/changes/${opts.changeId}`;
  const files = parsePorcelainPaths(await runGit(mainRepo, ["status", "--porcelain", "--", changeDir]));
  if (files.length === 0)
    return [];
  let staged = false;
  try {
    const cachedOut = await runGit(mainRepo, ["diff", "--cached", "--name-only"]);
    const stagedOutside = cachedOut.split(`
`).map((l) => l.trim()).filter(Boolean).filter((p) => p !== changeDir && !p.startsWith(`${changeDir}/`));
    if (stagedOutside.length > 0) {
      throw new Error(`主仓库 index 除 \`${changeDir}\` 外存在其它已暂存内容，拒绝自动合并污染文档：
` + stagedOutside.map((p) => `- \`${p}\``).join(`
`) + `
请人工核对处理。`);
    }
    if (!await isWorktreeClean(worktreePath)) {
      throw new Error(`worktree "${worktreePath}" 存在未 commit 内容，拒绝自动合并主仓库污染文档，请先 commit 再重试。`);
    }
    const wtTip = await runGit(worktreePath, ["rev-parse", "HEAD"]);
    if (opts.baseRef) {
      const diverged = (await runGit(worktreePath, ["diff", "--name-only", opts.baseRef, wtTip, "--", ...files])).trim();
      if (diverged.length > 0) {
        throw new Error(`以下污染文件在 worktree 分支中已相对基准分支发生变更（分叉），拒绝自动合并：
` + diverged.split(`
`).filter(Boolean).map((p) => `- \`${p}\``).join(`
`) + `
请人工核对处理。`);
      }
    }
    const aheadCount = parseInt((await runGit(mainRepo, ["rev-list", "--count", `${wtTip}..HEAD`])).trim(), 10);
    if (!Number.isNaN(aheadCount) && aheadCount > 0) {
      throw new Error(`主仓库分支已相对 worktree 分支前进 ${aheadCount} 个提交，自动合并将夹带其它变更内容，拒绝自动合并。
` + `请人工核对处理。`);
    }
    const addResult = await runGitChecked(mainRepo, ["add", "--", changeDir]);
    if (!addResult.success)
      throw new Error(`git add 主仓库 ${changeDir} 失败：${addResult.stderr}`);
    staged = true;
    const tree = (await runGit(mainRepo, ["write-tree"])).trim();
    if (!tree)
      throw new Error("git write-tree 失败：主仓库暂存区为空，无法生成合并提交。");
    const pollCommit = (await runGit(mainRepo, [
      "commit-tree",
      tree,
      "-p",
      "HEAD",
      "-m",
      "docs(openspec): reconcile main-repo edits into worktree branch"
    ])).trim();
    if (!pollCommit)
      throw new Error("git commit-tree 失败：无法创建合并提交。");
    const mergeResult = await runGitChecked(worktreePath, ["merge", "--no-ff", pollCommit]);
    if (!mergeResult.success) {
      await runGitChecked(worktreePath, ["merge", "--abort"]);
      throw new Error(`worktree 合并主仓库污染文档失败（冲突）：${mergeResult.stderr}
` + `已中止合并，请人工核对处理。`);
    }
    return files;
  } finally {
    if (staged) {
      await runGitChecked(mainRepo, ["restore", "--staged", "--worktree", "--", changeDir]);
    }
  }
}
async function autoCommitWorktreeChanges(wtPath, agent, stepId) {
  const statusRes = await runGitChecked(wtPath, ["status", "--porcelain", "-uall"]);
  if (!statusRes.success) {
    return { status: "failed", files: [], untrackedFiles: [], stderr: statusRes.stderr };
  }
  const trackedFiles = [];
  const untrackedDocFiles = [];
  const untrackedOtherFiles = [];
  const seen = new Set;
  const pushUnique = (list, path2) => {
    if (seen.has(path2))
      return;
    seen.add(path2);
    list.push(path2);
  };
  for (const entry of parseStatusEntries(statusRes.stdout)) {
    const isUntracked = entry.x === "?" && entry.y === "?";
    if (isUntracked) {
      for (const path2 of entry.paths) {
        if (!path2 || path2.startsWith("openspec/states/"))
          continue;
        pushUnique(isDocLikePath(path2) ? untrackedDocFiles : untrackedOtherFiles, path2);
      }
      continue;
    }
    const newPath = entry.paths[entry.paths.length - 1];
    if (!newPath || newPath.startsWith("openspec/states/"))
      continue;
    pushUnique(trackedFiles, newPath);
  }
  if (trackedFiles.length === 0 && untrackedDocFiles.length === 0) {
    return { status: "skipped", files: [], untrackedFiles: untrackedOtherFiles };
  }
  const committedFiles = [...trackedFiles, ...untrackedDocFiles];
  const addResult = await runGitChecked(wtPath, ["add", "-u", "--", ".", ":(exclude)openspec/states"]);
  if (!addResult.success) {
    return { status: "failed", files: committedFiles, untrackedFiles: untrackedOtherFiles, stderr: addResult.stderr };
  }
  if (untrackedDocFiles.length > 0) {
    const addDocResult = await runGitChecked(wtPath, ["add", "--", ...untrackedDocFiles]);
    if (!addDocResult.success) {
      return { status: "failed", files: committedFiles, untrackedFiles: untrackedOtherFiles, stderr: addDocResult.stderr };
    }
  }
  const commitResult = await runGitChecked(wtPath, [
    "commit",
    "-m",
    `docs(opx): direct fixes by ${agent} (${stepId})`
  ]);
  if (!commitResult.success) {
    return { status: "failed", files: committedFiles, untrackedFiles: untrackedOtherFiles, stderr: commitResult.stderr };
  }
  return { status: "committed", files: committedFiles, untrackedFiles: untrackedOtherFiles };
}
var defaultOpenSpecCliRunner = (cwd, args) => new Promise((resolve) => {
  execFile("openspec", args, { cwd, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err && err.code === "ENOENT") {
      resolve({ success: false, stdout: "", stderr: "ENOENT" });
      return;
    }
    resolve({ success: !err, stdout: stdout || "", stderr: stderr || (err ? String(err.message) : "") });
  });
});
var openspecCliRunner = defaultOpenSpecCliRunner;
async function archiveOpenspecChange(worktreePath, changeId, opts = {}) {
  const runCli = opts.runCli ?? openspecCliRunner;
  const changeDir = path.join(worktreePath, "openspec", "changes", changeId);
  if (!await pathExists(changeDir)) {
    return { status: "skipped", reason: "change 目录不存在（可能已归档）" };
  }
  const cliRes = await runCli(worktreePath, ["archive", changeId, "-y", "--json"]);
  if (cliRes.stderr.includes("ENOENT")) {
    return { status: "skipped", reason: "openspec CLI 未安装" };
  }
  if (!cliRes.success) {
    const summary = (cliRes.stderr || cliRes.stdout).trim();
    return { status: "failed", error: summary.length > 0 ? summary.slice(0, 500) : `openspec archive ${changeId} 退出码非零` };
  }
  const statusRes = await runGitChecked(worktreePath, ["status", "--porcelain", "openspec"]);
  if (!statusRes.success) {
    return { status: "failed", error: `归档后 git status 查询失败：${statusRes.stderr}` };
  }
  if (statusRes.stdout.length === 0) {
    return { status: "archived", committed: false };
  }
  const addRes = await runGitChecked(worktreePath, ["add", "openspec"]);
  if (!addRes.success) {
    return { status: "failed", error: `归档产物 git add 失败：${addRes.stderr}` };
  }
  const commitRes = await runGitChecked(worktreePath, ["commit", "-m", `chore(openspec): archive change ${changeId}`]);
  if (!commitRes.success) {
    return { status: "failed", error: `归档产物 git commit 失败：${commitRes.stderr}` };
  }
  return { status: "archived", committed: true };
}

// src/core/state.ts
import path2 from "path";
import { mkdirSync, rmSync, statSync, readFileSync, writeFileSync, existsSync, readdirSync, copyFileSync, cpSync } from "node:fs";
import { readFile as readFile2, writeFile as writeFile2 } from "node:fs/promises";

// src/core/workflow/types.ts
var WORK_ITEM_PHASES = ["todo", "in_progress", "review", "done", "cancelled"];
var EXEMPT_REQUEST_KEY = "exempt_request";
function tagKey(stepId, agentKey) {
  return `${stepId}:${agentKey}`;
}
function stepAgentIds(step) {
  return step.agents.map((a) => a.id);
}

// src/core/task-children.ts
function taskChildrenOf(item) {
  return (item.children ?? []).filter((c) => c.type === "task");
}
function issueChildrenOf(item) {
  return (item.children ?? []).filter((c) => c.type === "issue");
}
function taskChildById(item, id) {
  return item.children.find((c) => c.type === "task" && (c.id === id || c.externalId === id)) ?? null;
}
function normalizeTaskChildIds(rawIds, item) {
  const byNumber = new Map;
  for (const c of taskChildrenOf(item)) {
    if (c.externalId !== undefined)
      byNumber.set(c.externalId, c.id);
  }
  return rawIds.map((id) => byNumber.get(id) ?? id);
}
function phaseToTaskStatus(phase, hasRejectReason) {
  switch (phase) {
    case "review":
      return "submitted";
    case "done":
    case "cancelled":
      return "verified";
    case "todo":
      return hasRejectReason ? "rejected" : "open";
    default:
      return "open";
  }
}
function taskListOf(item) {
  return taskChildrenOf(item).map((c) => ({
    id: c.id,
    specTrace: typeof c.metadata["specTrace"] === "string" ? c.metadata["specTrace"] : "",
    title: c.title,
    status: phaseToTaskStatus(c.phase, c.metadata["reject_reason"] !== undefined),
    taskNumber: typeof c.externalId === "string" ? c.externalId : "",
    rejectReason: typeof c.metadata["reject_reason"] === "string" ? c.metadata["reject_reason"] : null
  }));
}

// src/core/workflow/engine.ts
var REVIEW_STEP_TO_LAYER = {
  verify_tool: "tool",
  verify_task: "task",
  verify_quality: "quality",
  quality_review: "quality"
};
function childSourcePhase(child) {
  return reviewLayerFromMetadata(child);
}
function isTerminalPhase(phase) {
  return phase === "done" || phase === "cancelled";
}
function isTaskGroupSettled(item) {
  if (item.phase === "done" || item.metadata["completed_at"] !== undefined)
    return true;
  const noTags = Object.keys(item.tags).length === 0;
  const childrenSettled = item.children.filter((c) => c.type === "task").every((c) => c.phase === "todo" || isTerminalPhase(c.phase));
  return noTags && childrenSettled;
}
function isFinalTaskGroup(state, item) {
  return state.workItems.filter((w) => w.id.startsWith("task:") && w.id !== item.id).every((w) => isTerminalPhase(w.phase) || w.metadata["completed_at"] !== undefined);
}
function isBlockingSeverity(severity) {
  return severity !== undefined && BLOCKING_SEVERITIES.includes(severity);
}
function isInfoSeverity(severity) {
  return severity === "Info";
}
function readInternalCount(item, key) {
  const v = item.metadata[key];
  return typeof v === "number" ? v : 0;
}
function setInternalCount(item, key, value) {
  item.metadata[key] = value;
}
function createInitialWorkItem(input) {
  return {
    id: input.id,
    source: input.source,
    externalId: input.externalId,
    type: input.type,
    title: input.title,
    description: input.description,
    phase: "todo",
    suspended: false,
    currentStep: null,
    tags: {},
    metadata: {},
    children: [],
    labels: input.labels ?? [],
    severity: input.severity
  };
}
function effectiveMaxRetries(workflow, step) {
  return step.max_retries ?? workflow.max_retries;
}
function resolveCurrentStep(item, workflow) {
  if (item.currentStep) {
    const entry = workflow.stepMap.get(item.currentStep);
    if (entry)
      return { step: entry.step, phaseName: entry.phase.name };
    return null;
  }
  for (const phase of workflow.phases) {
    if (phase.name === item.phase && phase.steps.length > 0) {
      return { step: phase.steps[0], phaseName: phase.name };
    }
  }
  return null;
}
function phaseStepMismatch(item, workflow) {
  if (item.currentStep === null)
    return false;
  const current = resolveCurrentStep(item, workflow);
  if (!current)
    return true;
  return current.phaseName !== item.phase;
}
function getStepVerdict(item, stepId, agentKey) {
  return item.tags[tagKey(stepId, agentKey)] ?? "pending";
}
function agentsWithPendingExempt(item) {
  const agents = new Set;
  for (const child of item.children) {
    if (child.metadata[EXEMPT_REQUEST_KEY] === undefined)
      continue;
    if (isTerminalPhase(child.phase))
      continue;
    const source = readIssueSource(child);
    if (source)
      agents.add(source);
  }
  return [...agents];
}
function stepAgentsWithPendingExempt(item, step) {
  const stepAgentSet = new Set(stepAgentIds(step));
  return agentsWithPendingExempt(item).filter((a) => stepAgentSet.has(a));
}
function agentBlockingResolved(item, agent) {
  if (agentsWithPendingExempt(item).includes(agent))
    return false;
  const owned = item.children.filter((c) => c.type === "issue" && readIssueSource(c) === agent && isBlockingSeverity(c.severity));
  if (owned.length === 0)
    return false;
  return owned.every((c) => isTerminalPhase(c.phase));
}
function adjudicateStep(item, step) {
  const verdicts = step.agents.map((agent) => {
    const v = getStepVerdict(item, step.id, agent.id);
    if (v === "failed" && step.agents.length > 1 && agentBlockingResolved(item, agent.id))
      return "passed";
    return v;
  });
  if (verdicts.length > 0 && verdicts.every((v) => v === "passed"))
    return "passed";
  if (verdicts.some((v) => v === "failed"))
    return "failed";
  return "pending";
}
function recommendAgents(item, step) {
  if (step.always_run)
    return stepAgentIds(step);
  if (step.agents.length > 1) {
    const pending = step.agents.filter((agent) => getStepVerdict(item, step.id, agent.id) === "pending");
    if (pending.length > 0) {
      const exemptPending = stepAgentsWithPendingExempt(item, step);
      const dispatch = new Set(pending.map((a) => a.id));
      for (const id of exemptPending)
        dispatch.add(id);
      return [...dispatch];
    }
    return step.agents.filter((agent) => getStepVerdict(item, step.id, agent.id) === "failed").map((a) => a.id);
  }
  return step.agents.filter((agent) => getStepVerdict(item, step.id, agent.id) !== "passed").map((a) => a.id);
}
function applyAgentVerdict(item, stepId, agentKey, verdict) {
  item.tags[tagKey(stepId, agentKey)] = verdict;
}
function clearStepTags(item, stepId) {
  for (const key of Object.keys(item.tags)) {
    if (key.startsWith(`${stepId}:`))
      delete item.tags[key];
  }
}
function stepCanPass(item, step) {
  if (adjudicateStep(item, step) !== "passed")
    return false;
  const blockers = item.children.filter((child) => isBlockingSeverity(child.severity));
  if (step.id === "implement") {
    return blockers.every((child) => child.phase === "review" || isTerminalPhase(child.phase));
  }
  const layer = REVIEW_STEP_TO_LAYER[step.id];
  if (layer) {
    return blockers.every((child) => childSourcePhase(child) !== layer || isTerminalPhase(child.phase));
  }
  return blockers.every((child) => isTerminalPhase(child.phase));
}
function phaseStepsAllPassed(item, workflow, phaseName) {
  const phase = workflow.phases.find((p) => p.name === phaseName);
  if (!phase || phase.steps.length === 0)
    return false;
  return phase.steps.every((step) => adjudicateStep(item, step) === "passed");
}
function childReachedPhase(child, targetPhase) {
  if (isTerminalPhase(child.phase))
    return true;
  const targetIdx = WORK_ITEM_PHASES.indexOf(targetPhase);
  const childIdx = WORK_ITEM_PHASES.indexOf(child.phase);
  return childIdx >= targetIdx;
}
function forwardGatePassed(item, workflow, targetPhase) {
  if (!phaseStepsAllPassed(item, workflow, item.phase))
    return false;
  const issuesOk = item.children.filter((child) => isBlockingSeverity(child.severity)).every((child) => childReachedPhase(child, targetPhase));
  if (!issuesOk)
    return false;
  if (phaseOrderIndex(targetPhase) >= 2) {
    const tasksOk = item.children.filter((child) => child.type === "task").every((child) => childReachedPhase(child, targetPhase));
    if (!tasksOk)
      return false;
  }
  return true;
}
function rollbackChildren(item) {
  for (const child of item.children) {
    if (isTerminalPhase(child.phase))
      continue;
    if (child.phase === "review")
      continue;
    child.phase = "todo";
    child.currentStep = null;
  }
}
function hasUnresolvedChildren(item) {
  return item.children.some((child) => {
    if (child.type === "issue" && isInfoSeverity(child.severity))
      return false;
    return !isTerminalPhase(child.phase);
  });
}
function checkpointTriggered(item, workflow, step) {
  if (adjudicateStep(item, step) === "passed" && !step.always_run)
    return false;
  const retryCount = readInternalCount(item, "_retryCount");
  if (retryCount <= 0)
    return false;
  if (retryCount % effectiveMaxRetries(workflow, step) !== 0)
    return false;
  return hasUnresolvedChildren(item);
}
function applyCheckpointContinue(item, step) {
  clearStepTags(item, step.id);
  item.metadata["_checkpoint"] = false;
  resetInternalRetryCount(item);
}
function applyCheckpointGiveup(item, step) {
  for (const child of item.children) {
    if (!isTerminalPhase(child.phase))
      child.phase = "cancelled";
  }
  for (const agent of step.agents) {
    applyAgentVerdict(item, step.id, agent.id, "passed");
  }
  item.metadata["_checkpoint"] = false;
  resetInternalRetryCount(item);
}
function incrementRetry(item) {
  setInternalCount(item, "_retryCount", readInternalCount(item, "_retryCount") + 1);
}
function resetInternalRetryCount(item) {
  setInternalCount(item, "_retryCount", 0);
}
function suspendItem(item, reason) {
  item.suspended = true;
  item.metadata["suspend_reason"] = reason;
}
var REVIEW_FIX_POLICY_KEY = "review_fix_policy";
function reviewFixPolicyOf(item) {
  const v = item.metadata[REVIEW_FIX_POLICY_KEY];
  return v === "none" || v === "fix" ? v : undefined;
}
function resolveStepInPhase(workflow, stepId) {
  const entry = workflow.stepMap.get(stepId);
  if (!entry)
    return null;
  return { step: entry.step, phaseName: entry.phase.name };
}
function phaseOrderIndex(phase) {
  return WORK_ITEM_PHASES.indexOf(phase);
}
function applyDoneTransition(item) {
  const unfinishedTasks = item.children.filter((child) => child.type === "task" && !isTerminalPhase(child.phase));
  if (unfinishedTasks.length > 0) {
    return { advanced: false, reason: "存在未完成的子任务（task children 未达终态），无法进入 done。" };
  }
  item.phase = "done";
  item.currentStep = null;
  return { advanced: true, target: "done" };
}
function applyTransition(item, workflow, direction) {
  const current = resolveCurrentStep(item, workflow);
  if (!current) {
    return { advanced: false, reason: `WorkItem phase="${item.phase}" 在 workflow 中无对应 step 容器。` };
  }
  const target = direction === "pass" ? current.step.transitions.on_pass : current.step.transitions.on_fail;
  if (direction === "fail" && target === "implement" && reviewFixPolicyOf(item) === "none") {
    return applyDoneTransition(item);
  }
  if (target === "done") {
    return applyDoneTransition(item);
  }
  if (target === "halt") {
    suspendItem(item, "halt");
    return { advanced: true, target: "halt" };
  }
  const resolved = resolveStepInPhase(workflow, target);
  if (!resolved) {
    return { advanced: false, reason: `transition 目标 "${target}" 无法解析。` };
  }
  if (resolved.phaseName === item.phase) {
    item.currentStep = resolved.step.id;
    return { advanced: true, target };
  }
  if (direction === "pass") {
    if (!forwardGatePassed(item, workflow, resolved.phaseName)) {
      return {
        advanced: false,
        reason: `跨 phase 正向推进被门禁拦截：当前 phase "${item.phase}" 未全部 step passed 或存在 Low+ children 未达到目标 phase "${resolved.phaseName}"。`
      };
    }
    item.phase = resolved.phaseName;
    item.currentStep = resolved.step.id;
    return { advanced: true, target };
  }
  rollbackChildren(item);
  incrementRetry(item);
  clearStepTags(item, resolved.step.id);
  item.phase = resolved.phaseName;
  item.currentStep = resolved.step.id;
  return { advanced: true, target };
}
function forwardAdvanceBlockReason(item, workflow, step) {
  const target = step.transitions.on_pass;
  if (target === "done") {
    const unfinishedTasks = item.children.filter((c) => c.type === "task" && !isTerminalPhase(c.phase));
    if (unfinishedTasks.length > 0) {
      return `存在 ${unfinishedTasks.length} 个未达终态的 task child（#${unfinishedTasks.map((c) => c.id).join("、")}），无法推进到 done。`;
    }
    return;
  }
  if (target === "halt")
    return;
  const resolved = resolveStepInPhase(workflow, target);
  if (!resolved)
    return `transition 目标 "${target}" 无法解析。`;
  if (resolved.phaseName === item.phase)
    return;
  if (!forwardGatePassed(item, workflow, resolved.phaseName)) {
    const notReached = item.children.filter((c) => c.type === "task" && !childReachedPhase(c, resolved.phaseName));
    if (notReached.length > 0) {
      return `跨 phase 正向推进被门禁拦截：目标 phase "${resolved.phaseName}" 要求全部 task child 达 ${resolved.phaseName} 态，以下 task 未达标：#${notReached.map((c) => c.id).join("、")}。`;
    }
    return `跨 phase 正向推进被门禁拦截：当前 phase "${item.phase}" 未全部 step passed 或存在 Low+ children 未达到目标 phase "${resolved.phaseName}"。`;
  }
  return;
}
function blockingStepChildren(item, step) {
  const layer = REVIEW_STEP_TO_LAYER[step.id];
  return item.children.filter((child) => {
    if (!isBlockingSeverity(child.severity))
      return false;
    if (isTerminalPhase(child.phase))
      return false;
    if (step.id === "implement" && child.phase === "review")
      return false;
    if (layer && childSourcePhase(child) !== layer)
      return false;
    return true;
  });
}
function blockedSupplementAgents(item, step) {
  const agents = new Set;
  const stepAgentSet = new Set(stepAgentIds(step));
  for (const child of blockingStepChildren(item, step)) {
    if (child.metadata[EXEMPT_REQUEST_KEY] === undefined && child.phase !== "review")
      continue;
    const source = readIssueSource(child);
    if (!source || !stepAgentSet.has(source))
      continue;
    agents.add(source);
  }
  return [...agents];
}
function recommendForItem(item, workflow) {
  if (item.suspended) {
    const reason = item.metadata["suspend_reason"] || "suspended";
    return {
      status: "suspended",
      stepId: item.currentStep,
      agents: [],
      message: `WorkItem 已暂停（${reason}），跳过调度。`
    };
  }
  const current = resolveCurrentStep(item, workflow);
  if (!current) {
    return {
      status: "blocked",
      stepId: null,
      agents: [],
      blockedReason: `WorkItem phase="${item.phase}" 在 workflow 中无对应 step 容器。`
    };
  }
  if (current.step.id === "implement" && reviewFixPolicyOf(item) === "none") {
    return {
      status: "blocked",
      stepId: current.step.id,
      agents: [],
      blockedReason: "只审（fix=none）会话不可进入 implement（修复步骤逻辑上不可达），请核对 state 后按需调用 opx_orch_init(recovery=...) 恢复。"
    };
  }
  if (checkpointTriggered(item, workflow, current.step)) {
    return {
      status: "checkpoint",
      stepId: current.step.id,
      agents: [],
      checkpoint: {
        retryCount: readInternalCount(item, "_retryCount"),
        effectiveMaxRetries: effectiveMaxRetries(workflow, current.step)
      }
    };
  }
  const adjudication = adjudicateStep(item, current.step);
  if (adjudication === "passed" && !current.step.always_run) {
    if (!stepCanPass(item, current.step)) {
      const blockingChildren = blockingStepChildren(item, current.step);
      const recheckCount = blockingChildren.filter((c) => c.phase === "review" && c.metadata[EXEMPT_REQUEST_KEY] === undefined).length;
      const exemptCount = blockingChildren.filter((c) => c.metadata[EXEMPT_REQUEST_KEY] !== undefined).length;
      const todoCount = blockingChildren.length - recheckCount - exemptCount;
      const isReviewStep = REVIEW_STEP_TO_LAYER[current.step.id] !== undefined;
      const agents2 = isReviewStep ? blockedSupplementAgents(item, current.step) : [];
      const blockedReason = agents2.length > 0 ? `step 全部 agent 已 passed 但存在 ${blockingChildren.length} 个本层待复核/待裁定 blocking children（待复核 ${recheckCount}、豁免申请中 ${exemptCount}），需报源 reviewer 补交复核/裁定解除阻塞。` : todoCount > 0 ? `step 全部 agent 已 passed 但存在 ${blockingChildren.length} 个未到终态的 blocking children（待修复 ${todoCount}、豁免申请中 ${exemptCount}），需 developer 修复后重新提交审查。` : `step 全部 agent 已 passed 但存在 ${blockingChildren.length} 个待复核/豁免申请中的 blocking children 且无法推导需补交的 reviewer，请核对 state 后按需调用 opx_orch_init(recovery=...) 恢复。`;
      return {
        status: "blocked",
        stepId: current.step.id,
        agents: agents2,
        blockedReason
      };
    }
    const gateBlock = forwardAdvanceBlockReason(item, workflow, current.step);
    if (gateBlock) {
      if (current.phaseName === "review" && taskChildrenOf(item).some((c) => c.phase === "review")) {
        return {
          status: "blocked",
          stepId: current.step.id,
          agents: stepAgentIds(current.step),
          blockedReason: `${gateBlock}需该 step 审查者经 opx_agent_submit 补交 verified_tasks（覆盖全部待验证任务）后推进。`
        };
      }
      return {
        status: "blocked",
        stepId: current.step.id,
        agents: [],
        blockedReason: gateBlock
      };
    }
    return {
      status: "terminal",
      stepId: current.step.id,
      agents: [],
      message: "step 已通过，沿 transitions.on_pass 推进（由 submit 工具执行状态迁移）。"
    };
  }
  const agents = recommendAgents(item, current.step);
  return {
    status: "recommend",
    stepId: current.step.id,
    agents
  };
}

// src/core/workflow/submit.ts
function resolveReviewStepForSource(workflow, source) {
  for (const phase of workflow.phases) {
    if (phase.name !== "review")
      continue;
    for (const step of phase.steps) {
      if (stepAgentIds(step).includes(source))
        return step;
    }
  }
  return null;
}
function resolveAdjudicatorStepForIssue(workflow, child, agentKey, role) {
  const prefix = role === "裁定" ? "豁免裁定失败" : "复核失败";
  const source = readIssueSource(child);
  const step = source ? resolveReviewStepForSource(workflow, source) : null;
  if (!step) {
    throw new Error(`${prefix}：issue "${child.id}" 的报源 "${source ?? "缺失"}" 不是合法 review agent（不属于任何 review step 的 agents），无法确定裁定者。`);
  }
  if (agentKey !== source) {
    throw new Error(`${prefix}：issue "${child.id}" 由报源 "${source}" 裁定（谁提谁裁定），${role}者必须为 "${source}"，拒绝 "${agentKey}" ${role}。`);
  }
  return step;
}
function assertSubmitRouting(workflow, item, stepId, agentKey) {
  const entry = workflow.stepMap.get(stepId);
  if (!entry) {
    throw new Error(`submit 路由失败：step "${stepId}" 未在 workflow "${workflow.id}" 中声明。`);
  }
  const step = entry.step;
  if (!stepAgentIds(step).includes(agentKey)) {
    throw new Error(`submit 越权：agent "${agentKey}" 不属于 step "${stepId}" 的 agents，拒绝提交且不产生任何状态变更。`);
  }
  if (item.currentStep !== null && item.currentStep !== stepId) {
    throw new Error(`submit 校验失败：item "${item.id}" 当前 step 为 "${item.currentStep}"，与提交的 step "${stepId}" 不一致，拒绝提交且不产生任何状态变更。`);
  }
  if (item.currentStep !== null && entry.phase.name !== item.phase) {
    throw new Error(`submit 校验失败：item "${item.id}" 的 phase "${item.phase}" 与 step "${stepId}" 归属阶段 "${entry.phase.name}" 不一致（phase ↔ step 错位），拒绝提交且不产生任何状态变更。`);
  }
  return step;
}
function chainPassAdvance(item, workflow, initialTarget) {
  let target = initialTarget;
  const maxIterations = workflow.stepMap.size * 2 + 1;
  for (let i = 0;i < maxIterations; i++) {
    if (item.suspended || isTerminalPhase(item.phase) || item.currentStep === null)
      break;
    const entry = workflow.stepMap.get(item.currentStep);
    if (!entry)
      break;
    const step = entry.step;
    if (step.always_run)
      break;
    if (adjudicateStep(item, step) !== "passed")
      break;
    if (!stepCanPass(item, step))
      break;
    const r = applyTransition(item, workflow, "pass");
    if (!r.advanced)
      break;
    if (r.target !== undefined)
      target = r.target;
  }
  return target;
}
function submitForStep(item, workflow, input) {
  const step = assertSubmitRouting(workflow, item, input.stepId, input.agentKey);
  const childById = new Map;
  for (const c of issueChildrenOf(item)) {
    childById.set(c.id, c);
    if (c.externalId)
      childById.set(c.externalId, c);
  }
  for (const c of taskChildrenOf(item)) {
    if (!childById.has(c.id))
      childById.set(c.id, c);
    if (c.externalId && !childById.has(c.externalId))
      childById.set(c.externalId, c);
  }
  for (const id of input.exemptIds ?? []) {
    const child = childById.get(id);
    if (child && isTerminalPhase(child.phase)) {
      throw new Error(`豁免申请失败：issue "${child.id}" 当前 phase 为 "${child.phase}"（终态），不允许对已终态的 issue 重新申请豁免。`);
    }
    if (child && isInfoSeverity(child.severity)) {
      throw new Error(`豁免申请失败：issue "${child.id}" 为 Info 级 issue，不阻塞提交，无需申请豁免。`);
    }
  }
  applyAgentVerdict(item, input.stepId, input.agentKey, input.verdict);
  const updated = new Set;
  for (const id of input.fixedIds ?? []) {
    const child = childById.get(id);
    if (child) {
      child.phase = child.type === "task" ? "done" : "review";
      updated.add(child.id);
    }
  }
  for (const id of input.exemptIds ?? []) {
    const child = childById.get(id);
    if (child) {
      child.metadata[EXEMPT_REQUEST_KEY] = { requestedBy: input.agentKey };
      if (child.type === "issue")
        child.phase = "review";
      updated.add(child.id);
    }
  }
  for (const nc of input.newChildren ?? []) {
    if (!childById.has(nc.id)) {
      item.children.push(nc);
      childById.set(nc.id, nc);
      updated.add(nc.id);
    }
  }
  const adjudication = adjudicateStep(item, step);
  const allAdjudicated = step.agents.every((a) => getStepVerdict(item, step.id, a.id) !== "pending");
  let advanced = false;
  let transitionTarget;
  let advanceBlockReason;
  if (adjudication === "passed" && stepCanPass(item, step)) {
    const r = applyTransition(item, workflow, "pass");
    advanced = r.advanced;
    if (r.advanced) {
      delete item.metadata["_advance_block_reason"];
      transitionTarget = chainPassAdvance(item, workflow, r.target);
    } else {
      advanceBlockReason = r.reason;
      item.metadata["_advance_block_reason"] = r.reason;
    }
  } else if (adjudication === "failed" && allAdjudicated) {
    const r = applyTransition(item, workflow, "fail");
    advanced = r.advanced;
    if (r.advanced) {
      delete item.metadata["_advance_block_reason"];
      if (r.target !== undefined)
        transitionTarget = r.target;
    } else {
      advanceBlockReason = r.reason;
      item.metadata["_advance_block_reason"] = r.reason;
    }
  }
  return {
    stepId: input.stepId,
    agentKey: input.agentKey,
    verdict: input.verdict,
    stepAdjudication: adjudication,
    advanced,
    transitionTarget,
    childrenUpdated: [...updated],
    reason: advanceBlockReason
  };
}
function adjudicateExempt(item, workflow, input) {
  const child = issueChildrenOf(item).find((c) => c.id === input.issueId) ?? taskChildrenOf(item).find((c) => c.id === input.issueId);
  if (!child) {
    throw new Error(`豁免裁定失败：issue "${input.issueId}" 不存在于 item "${item.id}" 的 children 中。`);
  }
  if (child.metadata[EXEMPT_REQUEST_KEY] === undefined) {
    throw new Error(`豁免裁定失败：issue "${input.issueId}" 未申请豁免（无 exempt_request 标记），仅可裁定带豁免申请标记的 issue。`);
  }
  resolveAdjudicatorStepForIssue(workflow, child, input.agentKey, "裁定");
  if (input.action === "dismissed") {
    child.phase = "cancelled";
  } else {
    child.phase = "todo";
  }
  delete child.metadata[EXEMPT_REQUEST_KEY];
  return { issueId: input.issueId, action: input.action, childPhase: child.phase };
}
function adjudicateRecheck(item, workflow, input) {
  const child = issueChildrenOf(item).find((c) => c.id === input.issueId);
  if (!child) {
    throw new Error(`复核失败：issue "${input.issueId}" 不存在于 item "${item.id}" 的 issue children 中。`);
  }
  if (child.phase !== "review") {
    throw new Error(`复核失败：issue "${input.issueId}" 当前 phase 为 "${child.phase}"，仅 review 态（已修复待复核）issue 可复核。`);
  }
  if (child.metadata[EXEMPT_REQUEST_KEY] !== undefined) {
    throw new Error(`复核失败：issue "${input.issueId}" 已申请豁免（exempt_request 标记），待裁定豁免申请应经 exempt_adjudications 裁定，不接受 recheck_adjudications 复核。`);
  }
  resolveAdjudicatorStepForIssue(workflow, child, input.agentKey, "复核");
  if (input.verdict === "passed") {
    child.phase = "done";
    delete child.metadata["reject_reason"];
  } else {
    if (!input.rejectReason) {
      throw new Error(`复核失败：issue "${input.issueId}" 驳回（verdict=rejected）必须提供 reject_reason。`);
    }
    child.phase = "todo";
    child.metadata["refix_count"] = (typeof child.metadata["refix_count"] === "number" ? child.metadata["refix_count"] : 0) + 1;
    child.metadata["reject_reason"] = input.rejectReason;
  }
  return { issueId: input.issueId, verdict: input.verdict, childPhase: child.phase };
}

// src/core/namespace.ts
import { createHash } from "node:crypto";
function generateIsolationNamespace(changeId) {
  return createHash("sha256").update(changeId).digest("hex").slice(0, 6);
}
function derivePortFromNamespace(namespace) {
  const n = parseInt(namespace, 16);
  return 20000 + n % 30000;
}

// src/core/state.ts
var LOCK_POLL_INTERVAL_MS = 50;
var LOCK_META_FILENAME = "meta.json";
var LOCK_STALE_THRESHOLD_MS = 1e4;
function isWorktreePath(worktree) {
  const gitPath = path2.join(worktree, ".git");
  try {
    return statSync(gitPath).isFile();
  } catch {
    return false;
  }
}
function getStateDir(worktree) {
  return path2.join(worktree, STATE_DIR_NAME, STATE_SUBDIR_NAME);
}
function getLegacyStateDir(worktree) {
  return path2.join(worktree, LEGACY_STATE_DIR_NAME, LEGACY_STATE_SUBDIR_NAME);
}
var WORKTREE_CONTEXT_FILE = "openspec/states/context.json";
var WORKTREE_CONTEXT_FILE_LEGACY = ".opencode/.orchestrate_state/context.json";
function migrateLegacyStateDir(root) {
  const legacyDir = getLegacyStateDir(root);
  if (!existsSync(legacyDir))
    return;
  const newDir = getStateDir(root);
  if (existsSync(newDir))
    return;
  mkdirSync(newDir, { recursive: true });
  for (const entry of readdirSync(legacyDir, { withFileTypes: true })) {
    const src = path2.join(legacyDir, entry.name);
    const dst = path2.join(newDir, entry.name);
    try {
      if (entry.isDirectory()) {
        cpSync(src, dst, { recursive: true });
      } else {
        copyFileSync(src, dst);
      }
    } catch {}
  }
}
async function readContextFromWorktree(worktreePath) {
  const fp = path2.join(worktreePath, WORKTREE_CONTEXT_FILE);
  const fpLegacy = path2.join(worktreePath, WORKTREE_CONTEXT_FILE_LEGACY);
  for (const p of [fp, fpLegacy]) {
    try {
      const raw = await readFile2(p, "utf-8");
      return JSON.parse(raw);
    } catch {}
  }
  return null;
}
async function writeContextToWorktree(worktreePath, changeId, taskGroupId) {
  const fp = path2.join(worktreePath, WORKTREE_CONTEXT_FILE);
  const fpLegacy = path2.join(worktreePath, WORKTREE_CONTEXT_FILE_LEGACY);
  if (!existsSync(fp) && existsSync(fpLegacy)) {
    migrateLegacyStateDir(worktreePath);
  }
  const dir = path2.dirname(fp);
  mkdirSync(dir, { recursive: true });
  await writeFile2(fp, JSON.stringify({ changeId, taskGroupId }, null, 2));
}
function getStatePath(worktree, changeId) {
  return path2.join(getStateDir(worktree), `${changeId}.json`);
}
async function readStateByWorktree(worktree, changeId) {
  if (isWorktreePath(worktree)) {
    const ctx = await readContextFromWorktree(worktree);
    if (!ctx)
      return null;
    const repoRoot = await discoverRepoRoot(worktree);
    return readStateByChangeId(repoRoot, ctx.changeId);
  }
  if (changeId) {
    return readStateByChangeId(worktree, changeId);
  }
  return null;
}
function taskGroupStatusToPhase(status) {
  switch (status) {
    case "task_analysis":
      return "todo";
    case "dev_impl":
      return "in_progress";
    case "review":
      return "review";
    case "completed":
      return "done";
  }
}
function taskGroupStatusToStep(status) {
  switch (status) {
    case "task_analysis":
      return "analyze";
    case "dev_impl":
      return "implement";
    case "review":
      return "verify_tool";
    case "completed":
      return null;
  }
}
function issueStatusToChildPhase(status) {
  switch (status) {
    case "verified":
      return "done";
    case "exempted":
      return "cancelled";
    case "submitted":
      return "review";
    default:
      return "todo";
  }
}
function issueReporterAgent(issue) {
  if (issue.sourcePhase === "quality")
    return DIMENSION_AGENT_MAP[issue.dimension] ?? "openspec-reviewer-tool";
  if (issue.sourcePhase === "task")
    return "openspec-reviewer-task";
  return "openspec-reviewer-tool";
}
function buildIssueWorkItem(issue) {
  const reporterAgent = issueReporterAgent(issue);
  const child = createInitialWorkItem({
    id: `issue:${issue.id}`,
    source: reporterAgent,
    externalId: issue.id,
    type: "issue",
    title: issue.description,
    description: issue.description,
    severity: issue.severity
  });
  child.phase = issueStatusToChildPhase(issue.status);
  child.metadata["source"] = reporterAgent;
  child.metadata["source_phase"] = issue.sourcePhase;
  child.metadata["dimension"] = issue.dimension;
  child.metadata["file"] = issue.file;
  child.metadata["line"] = issue.line;
  if (issue.status === "exemption_requested") {
    child.metadata[EXEMPT_REQUEST_KEY] = {
      requestedBy: reporterAgent,
      reason: issue.exemptReason
    };
  }
  return child;
}
function buildTaskWorkItemFromTaskGroup(tg) {
  const item = createInitialWorkItem({
    id: `task:${tg.id}`,
    source: "openspec",
    externalId: tg.id,
    type: "task",
    title: tg.name,
    description: tg.name,
    labels: ["openspec-change"]
  });
  item.phase = taskGroupStatusToPhase(tg.status);
  item.currentStep = taskGroupStatusToStep(tg.status);
  item.metadata = { source: "openspec", tasks: JSON.parse(JSON.stringify(tg.tasks ?? [])) };
  if (tg.worktreePath)
    item.metadata["worktree_path"] = tg.worktreePath;
  if (tg.branchName)
    item.metadata["branch_name"] = tg.branchName;
  if (tg.baseRef)
    item.metadata["base_ref"] = tg.baseRef;
  item.children = tg.issues.map(buildIssueWorkItem);
  return item;
}
function upgradeWorkItemsFromTaskGroups(groups) {
  return groups.map(buildTaskWorkItemFromTaskGroup);
}
async function readStateByChangeId(worktree, changeId) {
  const fp = getStatePath(worktree, changeId);
  const fpLegacy = path2.join(getLegacyStateDir(worktree), `${changeId}.json`);
  const readPath = existsSync(fp) ? fp : existsSync(fpLegacy) ? fpLegacy : null;
  let raw;
  try {
    raw = readPath ? JSON.parse(await readFile2(readPath, "utf-8")) : null;
  } catch {
    raw = null;
  }
  if (raw === null)
    return null;
  const legacy = raw;
  const sampleGroup = legacy.taskGroups?.[0];
  if (sampleGroup && !("tasks" in sampleGroup)) {
    throw new Error(`状态文件 "${legacy.changeId}" 是旧版本格式，不兼容当前版本。请重新初始化编排会话（opx_orch_init）。`);
  }
  if (!legacy.isolationNamespace) {
    legacy.isolationNamespace = generateIsolationNamespace(legacy.changeId);
  }
  for (const group of legacy.taskGroups || []) {
    group.blockers ??= [];
    for (const blocker of group.blockers) {
      if (blocker.status === "reported" || blocker.status === "ready_for_architect") {
        blocker.status = "awaiting_user";
      }
    }
    if (group.status === "task_analysis" && group.phases?.architect_review?.completed && !group.blockers.some((blocker) => blocker.status !== "resolved")) {
      group.status = "dev_impl";
    }
  }
  const needsUpgrade = !Array.isArray(legacy.workItems) || legacy.workItems.length === 0;
  const state = {
    changeId: legacy.changeId,
    isolationNamespace: legacy.isolationNamespace,
    taskGroupId: legacy.taskGroupId,
    baseBranch: legacy.baseBranch,
    workItems: needsUpgrade ? upgradeWorkItemsFromTaskGroups(legacy.taskGroups ?? []) : legacy.workItems,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
    unattended: legacy.unattended,
    mode: legacy.mode,
    kind: legacy.kind,
    reviewScope: legacy.reviewScope,
    stacks: legacy.stacks
  };
  if (needsUpgrade) {
    migrateLegacyStateDir(worktree);
    mkdirSync(getStateDir(worktree), { recursive: true });
    await writeFile2(fp, JSON.stringify(state, null, 2));
  }
  return state;
}
async function resolveStateRoot(worktree) {
  return isWorktreePath(worktree) ? await discoverRepoRoot(worktree) : worktree;
}
async function writeState(worktree, state) {
  const target = await resolveStateRoot(worktree);
  migrateLegacyStateDir(target);
  mkdirSync(getStateDir(target), { recursive: true });
  state.updatedAt = new Date().toISOString();
  await writeFile2(getStatePath(target, state.changeId), JSON.stringify(state, null, 2));
}
async function getLockPath(worktree, changeId) {
  const root = await resolveStateRoot(worktree);
  return path2.join(getStateDir(root), `${changeId}.review.lock`);
}
function readLockMeta(lockPath) {
  try {
    const meta = JSON.parse(readFileSync(path2.join(lockPath, LOCK_META_FILENAME), "utf-8"));
    if (meta && typeof meta.acquiredAt === "number")
      return meta;
    return null;
  } catch {
    return null;
  }
}
function acquireLock(lockPath, timeoutMs = 1e4) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tryAcquire = () => {
      try {
        mkdirSync(lockPath);
        try {
          writeFileSync(path2.join(lockPath, LOCK_META_FILENAME), JSON.stringify({ pid: process.pid, acquiredAt: Date.now() }));
        } catch (metaErr) {
          rmSync(lockPath, { recursive: true, force: true });
          reject(metaErr);
          return;
        }
        resolve();
      } catch (err) {
        if (err.code !== "EEXIST") {
          reject(err);
          return;
        }
        const meta = readLockMeta(lockPath);
        if (meta && Date.now() - meta.acquiredAt >= LOCK_STALE_THRESHOLD_MS) {
          rmSync(lockPath, { recursive: true, force: true });
          setTimeout(tryAcquire, LOCK_POLL_INTERVAL_MS);
          return;
        }
        if (Date.now() >= deadline) {
          reject(new Error(`获取锁超时：${lockPath}（${timeoutMs}ms 内未获得锁）`));
          return;
        }
        setTimeout(tryAcquire, LOCK_POLL_INTERVAL_MS);
      }
    };
    tryAcquire();
  });
}
function releaseLock(lockPath) {
  try {
    rmSync(lockPath, { recursive: true, force: true });
  } catch {}
}

// src/core/exemptions.ts
import path3 from "path";
import { mkdirSync as mkdirSync2, writeFileSync as writeFileSync2, renameSync } from "node:fs";
import { readFile as readFile3 } from "node:fs/promises";

// src/core/workflow/reset.ts
function resolveChildIssueFields(child) {
  const sourcePhase = reviewLayerFromMetadata(child);
  const dimension = REVIEW_DIMENSIONS.includes(child.metadata["dimension"]) ? child.metadata["dimension"] : "style";
  return {
    sourcePhase,
    dimension,
    file: typeof child.metadata["file"] === "string" ? child.metadata["file"] : "",
    line: typeof child.metadata["line"] === "number" ? child.metadata["line"] : 0
  };
}
function resetReviewTagsOnFix(item, input) {
  const fixed = new Set(input.fixedSourcePhases);
  const exempt = new Set(input.exemptSourcePhases);
  if (fixed.size > 0) {
    clearStepTags(item, "verify_tool");
    if (fixed.has("task"))
      clearStepTags(item, "verify_task");
  }
  if (exempt.has("task")) {
    clearStepTags(item, "verify_tool");
    clearStepTags(item, "verify_task");
  } else if (exempt.has("tool")) {
    clearStepTags(item, "verify_tool");
  }
  for (const d of input.touchedQualityDims) {
    const agent = DIMENSION_AGENT_MAP[d];
    if (agent) {
      delete item.tags[tagKey("verify_quality", agent)];
    }
  }
}
function dedupeNewChildren(item, newChildren) {
  const keyOf = (child) => {
    const f = resolveChildIssueFields(child);
    return [f.sourcePhase, f.dimension, f.file, f.line, child.description].join("\x00");
  };
  const accepted = [];
  let dedupedCount = 0;
  const existing = issueChildrenOf(item);
  for (const nc of newChildren) {
    const key = keyOf(nc);
    const duplicate = existing.some((child) => !isTerminalPhase(child.phase) && keyOf(child) === key);
    if (duplicate) {
      dedupedCount++;
      continue;
    }
    accepted.push(nc);
  }
  return { accepted, dedupedCount };
}

// src/core/exemptions.ts
var EXEMPTIONS_FILE = "exemptions.json";
var EXEMPTIONS_LOCK = "exemptions.lock";
var EXEMPTIONS_SCHEMA_VERSION = 1;
var EXEMPTED_HIT_KEY = "exempted_hit";
function exemptionKeyOf(rule, file, line) {
  if (rule === undefined || rule === "")
    return null;
  return [rule, file, line].join("\x00");
}
function emptyStore() {
  return { version: EXEMPTIONS_SCHEMA_VERSION, items: [] };
}
async function exemptionsDir(worktree) {
  const root = await resolveStateRoot(worktree);
  return getStateDir(root);
}
async function readExemptions(worktree) {
  const fp = path3.join(await exemptionsDir(worktree), EXEMPTIONS_FILE);
  try {
    const parsed = JSON.parse(await readFile3(fp, "utf-8"));
    if (parsed && Array.isArray(parsed.items)) {
      return { version: parsed.version ?? EXEMPTIONS_SCHEMA_VERSION, items: parsed.items };
    }
    return emptyStore();
  } catch {
    return emptyStore();
  }
}
async function writeExemptions(worktree, store) {
  const dir = await exemptionsDir(worktree);
  mkdirSync2(dir, { recursive: true });
  const target = path3.join(dir, EXEMPTIONS_FILE);
  const tmp = path3.join(dir, `${EXEMPTIONS_FILE}.tmp`);
  writeFileSync2(tmp, JSON.stringify(store, null, 2));
  renameSync(tmp, target);
}
async function upsertExemption(worktree, record) {
  const dir = await exemptionsDir(worktree);
  mkdirSync2(dir, { recursive: true });
  const lockPath = path3.join(dir, EXEMPTIONS_LOCK);
  await acquireLock(lockPath);
  try {
    const store = await readExemptions(worktree);
    const idx = store.items.findIndex((i) => i.key === record.key);
    if (idx >= 0) {
      store.items[idx] = record;
    } else {
      store.items.push(record);
    }
    await writeExemptions(worktree, store);
  } finally {
    releaseLock(lockPath);
  }
}
function buildExemptionRecord(child, opts) {
  const rule = typeof child.metadata["rule"] === "string" ? child.metadata["rule"] : undefined;
  const f = resolveChildIssueFields(child);
  const key = exemptionKeyOf(rule, f.file, f.line);
  if (!key)
    return null;
  return {
    key,
    rule,
    file: f.file,
    line: f.line,
    sourcePhase: f.sourcePhase,
    dimension: f.dimension,
    severity: child.severity ?? "",
    description: child.description,
    exemptedAt: new Date().toISOString(),
    exemptedBy: opts.exemptedBy,
    changeId: opts.changeId
  };
}
async function writeDismissedExemption(worktree, child, opts) {
  const record = buildExemptionRecord(child, opts);
  if (!record)
    return;
  try {
    await upsertExemption(worktree, record);
  } catch (err) {
    console.warn(`[exemptions] 项目级豁免清单写入失败（不影响裁定主流程）：${err.message}`);
  }
}
function applyExemptionDowngrade(children, store) {
  const keys = new Set(store.items.map((i) => i.key));
  let downgraded = 0;
  for (const c of children) {
    const rule = typeof c.metadata["rule"] === "string" ? c.metadata["rule"] : undefined;
    const file = typeof c.metadata["file"] === "string" ? c.metadata["file"] : "";
    const line = typeof c.metadata["line"] === "number" ? c.metadata["line"] : 0;
    const key = exemptionKeyOf(rule, file, line);
    if (key && keys.has(key)) {
      c.severity = "Info";
      c.metadata[EXEMPTED_HIT_KEY] = rule ?? true;
      c.description = `${c.description}

> 命中项目级豁免清单${rule ? `（rule=${rule}）` : ""}，保持现状。`;
      downgraded++;
    }
  }
  return downgraded;
}

// src/core/tasks-md.ts
function parseSpecTrace(line) {
  const m = line.match(/\[spec:([^\]]+)\]/);
  return m ? m[1].trim() : "";
}
function parseTasksForGroupFromContent(content, taskGroupId) {
  const tasks = [];
  const lines = content.split(`
`);
  let currentGroup = null;
  for (let i = 0;i < lines.length; i++) {
    const line = lines[i];
    const groupMatch = line.match(/^##\s+(\d+)\./);
    if (groupMatch) {
      if (currentGroup === taskGroupId)
        break;
      currentGroup = groupMatch[1];
      continue;
    }
    if (currentGroup !== taskGroupId)
      continue;
    const taskMatch = line.match(/^-\s+\[[\sx]\]\s+(.+)/);
    if (taskMatch) {
      const body = taskMatch[1];
      const taskNumberMatch = body.match(/^(\d+(?:\.\d+)+)\s+/);
      const taskNumber = taskNumberMatch ? taskNumberMatch[1] : "";
      const cleaned = (taskNumberMatch ? body.slice(taskNumberMatch[0].length) : body).replace(/\s*\[spec:[^\]]+\]\s*$/, "").trim();
      const specTrace = parseSpecTrace(body);
      tasks.push({ title: cleaned, specTrace, taskNumber });
    }
  }
  return tasks;
}
function extractRelevantSpecsFromTasks(tasks) {
  const set = new Set;
  for (const t of tasks) {
    if (!t.specTrace)
      continue;
    const parts = t.specTrace.split("#")[0];
    if (parts)
      set.add(parts);
  }
  return Array.from(set);
}
function parseTaskGroupsFromContent(content) {
  const groups = [];
  const lines = content.split(`
`);
  let currentGroup = null;
  let currentTaskCount = 0;
  for (const line of lines) {
    const groupMatch = line.match(/^##\s+(\d+)\./);
    if (groupMatch) {
      if (currentGroup)
        groups.push({ ...currentGroup, taskCount: currentTaskCount });
      currentGroup = { id: groupMatch[1], name: line.replace(/^##\s+\d+\.\s*/, "").trim() };
      currentTaskCount = 0;
      continue;
    }
    if (currentGroup) {
      if (/^-\s+\[[\sx]\]\s+/.test(line))
        currentTaskCount++;
    }
  }
  if (currentGroup)
    groups.push({ ...currentGroup, taskCount: currentTaskCount });
  return groups;
}

// node_modules/js-yaml/dist/js-yaml.mjs
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var jsYaml = {};
var loader = {};
var common = {};
var hasRequiredCommon;
function requireCommon() {
  if (hasRequiredCommon)
    return common;
  hasRequiredCommon = 1;
  function isNothing(subject) {
    return typeof subject === "undefined" || subject === null;
  }
  function isObject(subject) {
    return typeof subject === "object" && subject !== null;
  }
  function toArray(sequence) {
    if (Array.isArray(sequence))
      return sequence;
    else if (isNothing(sequence))
      return [];
    return [sequence];
  }
  function extend(target, source) {
    if (source) {
      const sourceKeys = Object.keys(source);
      for (let index = 0, length = sourceKeys.length;index < length; index += 1) {
        const key = sourceKeys[index];
        target[key] = source[key];
      }
    }
    return target;
  }
  function repeat(string, count) {
    let result = "";
    for (let cycle = 0;cycle < count; cycle += 1) {
      result += string;
    }
    return result;
  }
  function isNegativeZero(number) {
    return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
  }
  common.isNothing = isNothing;
  common.isObject = isObject;
  common.toArray = toArray;
  common.repeat = repeat;
  common.isNegativeZero = isNegativeZero;
  common.extend = extend;
  return common;
}
var exception;
var hasRequiredException;
function requireException() {
  if (hasRequiredException)
    return exception;
  hasRequiredException = 1;
  function formatError(exception2, compact) {
    let where = "";
    const message = exception2.reason || "(unknown reason)";
    if (!exception2.mark)
      return message;
    if (exception2.mark.name) {
      where += 'in "' + exception2.mark.name + '" ';
    }
    where += "(" + (exception2.mark.line + 1) + ":" + (exception2.mark.column + 1) + ")";
    if (!compact && exception2.mark.snippet) {
      where += `

` + exception2.mark.snippet;
    }
    return message + " " + where;
  }
  function YAMLException2(reason, mark) {
    Error.call(this);
    this.name = "YAMLException";
    this.reason = reason;
    this.mark = mark;
    this.message = formatError(this, false);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error().stack || "";
    }
  }
  YAMLException2.prototype = Object.create(Error.prototype);
  YAMLException2.prototype.constructor = YAMLException2;
  YAMLException2.prototype.toString = function toString(compact) {
    return this.name + ": " + formatError(this, compact);
  };
  exception = YAMLException2;
  return exception;
}
var snippet;
var hasRequiredSnippet;
function requireSnippet() {
  if (hasRequiredSnippet)
    return snippet;
  hasRequiredSnippet = 1;
  const common2 = requireCommon();
  function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
    let head = "";
    let tail = "";
    const maxHalfLength = Math.floor(maxLineLength / 2) - 1;
    if (position - lineStart > maxHalfLength) {
      head = " ... ";
      lineStart = position - maxHalfLength + head.length;
    }
    if (lineEnd - position > maxHalfLength) {
      tail = " ...";
      lineEnd = position + maxHalfLength - tail.length;
    }
    return {
      str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "→") + tail,
      pos: position - lineStart + head.length
    };
  }
  function padStart(string, max) {
    return common2.repeat(" ", max - string.length) + string;
  }
  function makeSnippet(mark, options) {
    options = Object.create(options || null);
    if (!mark.buffer)
      return null;
    if (!options.maxLength)
      options.maxLength = 79;
    if (typeof options.indent !== "number")
      options.indent = 1;
    if (typeof options.linesBefore !== "number")
      options.linesBefore = 3;
    if (typeof options.linesAfter !== "number")
      options.linesAfter = 2;
    const re = /\r?\n|\r|\0/g;
    const lineStarts = [0];
    const lineEnds = [];
    let match;
    let foundLineNo = -1;
    while (match = re.exec(mark.buffer)) {
      lineEnds.push(match.index);
      lineStarts.push(match.index + match[0].length);
      if (mark.position <= match.index && foundLineNo < 0) {
        foundLineNo = lineStarts.length - 2;
      }
    }
    if (foundLineNo < 0)
      foundLineNo = lineStarts.length - 1;
    let result = "";
    const lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
    const maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
    for (let i = 1;i <= options.linesBefore; i++) {
      if (foundLineNo - i < 0)
        break;
      const line2 = getLine(mark.buffer, lineStarts[foundLineNo - i], lineEnds[foundLineNo - i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]), maxLineLength);
      result = common2.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line2.str + `
` + result;
    }
    const line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
    result += common2.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + `
`;
    result += common2.repeat("-", options.indent + lineNoLength + 3 + line.pos) + `^
`;
    for (let i = 1;i <= options.linesAfter; i++) {
      if (foundLineNo + i >= lineEnds.length)
        break;
      const line2 = getLine(mark.buffer, lineStarts[foundLineNo + i], lineEnds[foundLineNo + i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]), maxLineLength);
      result += common2.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line2.str + `
`;
    }
    return result.replace(/\n$/, "");
  }
  snippet = makeSnippet;
  return snippet;
}
var type;
var hasRequiredType;
function requireType() {
  if (hasRequiredType)
    return type;
  hasRequiredType = 1;
  const YAMLException2 = requireException();
  const TYPE_CONSTRUCTOR_OPTIONS = [
    "kind",
    "multi",
    "resolve",
    "construct",
    "instanceOf",
    "predicate",
    "represent",
    "representName",
    "defaultStyle",
    "styleAliases"
  ];
  const YAML_NODE_KINDS = [
    "scalar",
    "sequence",
    "mapping"
  ];
  function compileStyleAliases(map2) {
    const result = {};
    if (map2 !== null) {
      Object.keys(map2).forEach(function(style) {
        map2[style].forEach(function(alias) {
          result[String(alias)] = style;
        });
      });
    }
    return result;
  }
  function Type2(tag, options) {
    options = options || {};
    Object.keys(options).forEach(function(name) {
      if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
        throw new YAMLException2('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
      }
    });
    this.options = options;
    this.tag = tag;
    this.kind = options["kind"] || null;
    this.resolve = options["resolve"] || function() {
      return true;
    };
    this.construct = options["construct"] || function(data) {
      return data;
    };
    this.instanceOf = options["instanceOf"] || null;
    this.predicate = options["predicate"] || null;
    this.represent = options["represent"] || null;
    this.representName = options["representName"] || null;
    this.defaultStyle = options["defaultStyle"] || null;
    this.multi = options["multi"] || false;
    this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
    if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
      throw new YAMLException2('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
    }
  }
  type = Type2;
  return type;
}
var schema;
var hasRequiredSchema;
function requireSchema() {
  if (hasRequiredSchema)
    return schema;
  hasRequiredSchema = 1;
  const YAMLException2 = requireException();
  const Type2 = requireType();
  function compileList(schema2, name) {
    const result = [];
    schema2[name].forEach(function(currentType) {
      let newIndex = result.length;
      result.forEach(function(previousType, previousIndex) {
        if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
          newIndex = previousIndex;
        }
      });
      result[newIndex] = currentType;
    });
    return result;
  }
  function compileMap() {
    const result = {
      scalar: {},
      sequence: {},
      mapping: {},
      fallback: {},
      multi: {
        scalar: [],
        sequence: [],
        mapping: [],
        fallback: []
      }
    };
    function collectType(type2) {
      if (type2.multi) {
        result.multi[type2.kind].push(type2);
        result.multi["fallback"].push(type2);
      } else {
        result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
      }
    }
    for (let index = 0, length = arguments.length;index < length; index += 1) {
      arguments[index].forEach(collectType);
    }
    return result;
  }
  function Schema2(definition) {
    return this.extend(definition);
  }
  Schema2.prototype.extend = function extend(definition) {
    let implicit = [];
    let explicit = [];
    if (definition instanceof Type2) {
      explicit.push(definition);
    } else if (Array.isArray(definition)) {
      explicit = explicit.concat(definition);
    } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
      if (definition.implicit)
        implicit = implicit.concat(definition.implicit);
      if (definition.explicit)
        explicit = explicit.concat(definition.explicit);
    } else {
      throw new YAMLException2("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
    }
    implicit.forEach(function(type2) {
      if (!(type2 instanceof Type2)) {
        throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
      if (type2.loadKind && type2.loadKind !== "scalar") {
        throw new YAMLException2("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
      }
      if (type2.multi) {
        throw new YAMLException2("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
      }
    });
    explicit.forEach(function(type2) {
      if (!(type2 instanceof Type2)) {
        throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
    });
    const result = Object.create(Schema2.prototype);
    result.implicit = (this.implicit || []).concat(implicit);
    result.explicit = (this.explicit || []).concat(explicit);
    result.compiledImplicit = compileList(result, "implicit");
    result.compiledExplicit = compileList(result, "explicit");
    result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
    return result;
  };
  schema = Schema2;
  return schema;
}
var str;
var hasRequiredStr;
function requireStr() {
  if (hasRequiredStr)
    return str;
  hasRequiredStr = 1;
  const Type2 = requireType();
  str = new Type2("tag:yaml.org,2002:str", {
    kind: "scalar",
    construct: function(data) {
      return data !== null ? data : "";
    }
  });
  return str;
}
var seq;
var hasRequiredSeq;
function requireSeq() {
  if (hasRequiredSeq)
    return seq;
  hasRequiredSeq = 1;
  const Type2 = requireType();
  seq = new Type2("tag:yaml.org,2002:seq", {
    kind: "sequence",
    construct: function(data) {
      return data !== null ? data : [];
    }
  });
  return seq;
}
var map;
var hasRequiredMap;
function requireMap() {
  if (hasRequiredMap)
    return map;
  hasRequiredMap = 1;
  const Type2 = requireType();
  map = new Type2("tag:yaml.org,2002:map", {
    kind: "mapping",
    construct: function(data) {
      return data !== null ? data : {};
    }
  });
  return map;
}
var failsafe;
var hasRequiredFailsafe;
function requireFailsafe() {
  if (hasRequiredFailsafe)
    return failsafe;
  hasRequiredFailsafe = 1;
  const Schema2 = requireSchema();
  failsafe = new Schema2({
    explicit: [
      requireStr(),
      requireSeq(),
      requireMap()
    ]
  });
  return failsafe;
}
var _null;
var hasRequired_null;
function require_null() {
  if (hasRequired_null)
    return _null;
  hasRequired_null = 1;
  const Type2 = requireType();
  function resolveYamlNull(data) {
    if (data === null)
      return true;
    const max = data.length;
    return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
  }
  function constructYamlNull() {
    return null;
  }
  function isNull(object) {
    return object === null;
  }
  _null = new Type2("tag:yaml.org,2002:null", {
    kind: "scalar",
    resolve: resolveYamlNull,
    construct: constructYamlNull,
    predicate: isNull,
    represent: {
      canonical: function() {
        return "~";
      },
      lowercase: function() {
        return "null";
      },
      uppercase: function() {
        return "NULL";
      },
      camelcase: function() {
        return "Null";
      },
      empty: function() {
        return "";
      }
    },
    defaultStyle: "lowercase"
  });
  return _null;
}
var bool;
var hasRequiredBool;
function requireBool() {
  if (hasRequiredBool)
    return bool;
  hasRequiredBool = 1;
  const Type2 = requireType();
  function resolveYamlBoolean(data) {
    if (data === null)
      return false;
    const max = data.length;
    return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
  }
  function constructYamlBoolean(data) {
    return data === "true" || data === "True" || data === "TRUE";
  }
  function isBoolean(object) {
    return Object.prototype.toString.call(object) === "[object Boolean]";
  }
  bool = new Type2("tag:yaml.org,2002:bool", {
    kind: "scalar",
    resolve: resolveYamlBoolean,
    construct: constructYamlBoolean,
    predicate: isBoolean,
    represent: {
      lowercase: function(object) {
        return object ? "true" : "false";
      },
      uppercase: function(object) {
        return object ? "TRUE" : "FALSE";
      },
      camelcase: function(object) {
        return object ? "True" : "False";
      }
    },
    defaultStyle: "lowercase"
  });
  return bool;
}
var int;
var hasRequiredInt;
function requireInt() {
  if (hasRequiredInt)
    return int;
  hasRequiredInt = 1;
  const common2 = requireCommon();
  const Type2 = requireType();
  function isHexCode(c) {
    return c >= 48 && c <= 57 || c >= 65 && c <= 70 || c >= 97 && c <= 102;
  }
  function isOctCode(c) {
    return c >= 48 && c <= 55;
  }
  function isDecCode(c) {
    return c >= 48 && c <= 57;
  }
  function resolveYamlInteger(data) {
    if (data === null)
      return false;
    const max = data.length;
    let index = 0;
    let hasDigits = false;
    if (!max)
      return false;
    let ch = data[index];
    if (ch === "-" || ch === "+") {
      ch = data[++index];
    }
    if (ch === "0") {
      if (index + 1 === max)
        return true;
      ch = data[++index];
      if (ch === "b") {
        index++;
        for (;index < max; index++) {
          ch = data[index];
          if (ch !== "0" && ch !== "1")
            return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
      if (ch === "x") {
        index++;
        for (;index < max; index++) {
          if (!isHexCode(data.charCodeAt(index)))
            return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
      if (ch === "o") {
        index++;
        for (;index < max; index++) {
          if (!isOctCode(data.charCodeAt(index)))
            return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
    }
    for (;index < max; index++) {
      if (!isDecCode(data.charCodeAt(index))) {
        return false;
      }
      hasDigits = true;
    }
    if (!hasDigits)
      return false;
    return isFinite(parseYamlInteger(data));
  }
  function parseYamlInteger(data) {
    let value = data;
    let sign = 1;
    let ch = value[0];
    if (ch === "-" || ch === "+") {
      if (ch === "-")
        sign = -1;
      value = value.slice(1);
      ch = value[0];
    }
    if (value === "0")
      return 0;
    if (ch === "0") {
      if (value[1] === "b")
        return sign * parseInt(value.slice(2), 2);
      if (value[1] === "x")
        return sign * parseInt(value.slice(2), 16);
      if (value[1] === "o")
        return sign * parseInt(value.slice(2), 8);
    }
    return sign * parseInt(value, 10);
  }
  function constructYamlInteger(data) {
    return parseYamlInteger(data);
  }
  function isInteger(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common2.isNegativeZero(object));
  }
  int = new Type2("tag:yaml.org,2002:int", {
    kind: "scalar",
    resolve: resolveYamlInteger,
    construct: constructYamlInteger,
    predicate: isInteger,
    represent: {
      binary: function(obj) {
        return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
      },
      octal: function(obj) {
        return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
      },
      decimal: function(obj) {
        return obj.toString(10);
      },
      hexadecimal: function(obj) {
        return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
      }
    },
    defaultStyle: "decimal",
    styleAliases: {
      binary: [2, "bin"],
      octal: [8, "oct"],
      decimal: [10, "dec"],
      hexadecimal: [16, "hex"]
    }
  });
  return int;
}
var float;
var hasRequiredFloat;
function requireFloat() {
  if (hasRequiredFloat)
    return float;
  hasRequiredFloat = 1;
  const common2 = requireCommon();
  const Type2 = requireType();
  const YAML_FLOAT_PATTERN = new RegExp("^(?:[-+]?(?:[0-9]+)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
  const YAML_FLOAT_SPECIAL_PATTERN = new RegExp("^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
  function resolveYamlFloat(data) {
    if (data === null)
      return false;
    if (!YAML_FLOAT_PATTERN.test(data)) {
      return false;
    }
    if (isFinite(parseFloat(data, 10))) {
      return true;
    }
    return YAML_FLOAT_SPECIAL_PATTERN.test(data);
  }
  function constructYamlFloat(data) {
    let value = data.toLowerCase();
    const sign = value[0] === "-" ? -1 : 1;
    if ("+-".indexOf(value[0]) >= 0) {
      value = value.slice(1);
    }
    if (value === ".inf") {
      return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    } else if (value === ".nan") {
      return NaN;
    }
    return sign * parseFloat(value, 10);
  }
  const SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
  function representYamlFloat(object, style) {
    if (isNaN(object)) {
      switch (style) {
        case "lowercase":
          return ".nan";
        case "uppercase":
          return ".NAN";
        case "camelcase":
          return ".NaN";
      }
    } else if (Number.POSITIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return ".inf";
        case "uppercase":
          return ".INF";
        case "camelcase":
          return ".Inf";
      }
    } else if (Number.NEGATIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return "-.inf";
        case "uppercase":
          return "-.INF";
        case "camelcase":
          return "-.Inf";
      }
    } else if (common2.isNegativeZero(object)) {
      return "-0.0";
    }
    const res = object.toString(10);
    return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
  }
  function isFloat(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common2.isNegativeZero(object));
  }
  float = new Type2("tag:yaml.org,2002:float", {
    kind: "scalar",
    resolve: resolveYamlFloat,
    construct: constructYamlFloat,
    predicate: isFloat,
    represent: representYamlFloat,
    defaultStyle: "lowercase"
  });
  return float;
}
var json;
var hasRequiredJson;
function requireJson() {
  if (hasRequiredJson)
    return json;
  hasRequiredJson = 1;
  json = requireFailsafe().extend({
    implicit: [
      require_null(),
      requireBool(),
      requireInt(),
      requireFloat()
    ]
  });
  return json;
}
var core;
var hasRequiredCore;
function requireCore() {
  if (hasRequiredCore)
    return core;
  hasRequiredCore = 1;
  core = requireJson();
  return core;
}
var timestamp;
var hasRequiredTimestamp;
function requireTimestamp() {
  if (hasRequiredTimestamp)
    return timestamp;
  hasRequiredTimestamp = 1;
  const Type2 = requireType();
  const YAML_DATE_REGEXP = new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$");
  const YAML_TIMESTAMP_REGEXP = new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$");
  function resolveYamlTimestamp(data) {
    if (data === null)
      return false;
    if (YAML_DATE_REGEXP.exec(data) !== null)
      return true;
    if (YAML_TIMESTAMP_REGEXP.exec(data) !== null)
      return true;
    return false;
  }
  function constructYamlTimestamp(data) {
    let fraction = 0;
    let delta = null;
    let match = YAML_DATE_REGEXP.exec(data);
    if (match === null)
      match = YAML_TIMESTAMP_REGEXP.exec(data);
    if (match === null)
      throw new Error("Date resolve error");
    const year = +match[1];
    const month = +match[2] - 1;
    const day = +match[3];
    if (!match[4]) {
      return new Date(Date.UTC(year, month, day));
    }
    const hour = +match[4];
    const minute = +match[5];
    const second = +match[6];
    if (match[7]) {
      fraction = match[7].slice(0, 3);
      while (fraction.length < 3) {
        fraction += "0";
      }
      fraction = +fraction;
    }
    if (match[9]) {
      const tzHour = +match[10];
      const tzMinute = +(match[11] || 0);
      delta = (tzHour * 60 + tzMinute) * 60000;
      if (match[9] === "-")
        delta = -delta;
    }
    const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
    if (delta)
      date.setTime(date.getTime() - delta);
    return date;
  }
  function representYamlTimestamp(object) {
    return object.toISOString();
  }
  timestamp = new Type2("tag:yaml.org,2002:timestamp", {
    kind: "scalar",
    resolve: resolveYamlTimestamp,
    construct: constructYamlTimestamp,
    instanceOf: Date,
    represent: representYamlTimestamp
  });
  return timestamp;
}
var merge;
var hasRequiredMerge;
function requireMerge() {
  if (hasRequiredMerge)
    return merge;
  hasRequiredMerge = 1;
  const Type2 = requireType();
  function resolveYamlMerge(data) {
    return data === "<<" || data === null;
  }
  merge = new Type2("tag:yaml.org,2002:merge", {
    kind: "scalar",
    resolve: resolveYamlMerge
  });
  return merge;
}
var binary;
var hasRequiredBinary;
function requireBinary() {
  if (hasRequiredBinary)
    return binary;
  hasRequiredBinary = 1;
  const Type2 = requireType();
  const BASE64_MAP = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
  function resolveYamlBinary(data) {
    if (data === null)
      return false;
    let bitlen = 0;
    const max = data.length;
    const map2 = BASE64_MAP;
    for (let idx = 0;idx < max; idx++) {
      const code = map2.indexOf(data.charAt(idx));
      if (code > 64)
        continue;
      if (code < 0)
        return false;
      bitlen += 6;
    }
    return bitlen % 8 === 0;
  }
  function constructYamlBinary(data) {
    const input = data.replace(/[\r\n=]/g, "");
    const max = input.length;
    const map2 = BASE64_MAP;
    let bits = 0;
    const result = [];
    for (let idx = 0;idx < max; idx++) {
      if (idx % 4 === 0 && idx) {
        result.push(bits >> 16 & 255);
        result.push(bits >> 8 & 255);
        result.push(bits & 255);
      }
      bits = bits << 6 | map2.indexOf(input.charAt(idx));
    }
    const tailbits = max % 4 * 6;
    if (tailbits === 0) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    } else if (tailbits === 18) {
      result.push(bits >> 10 & 255);
      result.push(bits >> 2 & 255);
    } else if (tailbits === 12) {
      result.push(bits >> 4 & 255);
    }
    return new Uint8Array(result);
  }
  function representYamlBinary(object) {
    let result = "";
    let bits = 0;
    const max = object.length;
    const map2 = BASE64_MAP;
    for (let idx = 0;idx < max; idx++) {
      if (idx % 3 === 0 && idx) {
        result += map2[bits >> 18 & 63];
        result += map2[bits >> 12 & 63];
        result += map2[bits >> 6 & 63];
        result += map2[bits & 63];
      }
      bits = (bits << 8) + object[idx];
    }
    const tail = max % 3;
    if (tail === 0) {
      result += map2[bits >> 18 & 63];
      result += map2[bits >> 12 & 63];
      result += map2[bits >> 6 & 63];
      result += map2[bits & 63];
    } else if (tail === 2) {
      result += map2[bits >> 10 & 63];
      result += map2[bits >> 4 & 63];
      result += map2[bits << 2 & 63];
      result += map2[64];
    } else if (tail === 1) {
      result += map2[bits >> 2 & 63];
      result += map2[bits << 4 & 63];
      result += map2[64];
      result += map2[64];
    }
    return result;
  }
  function isBinary(obj) {
    return Object.prototype.toString.call(obj) === "[object Uint8Array]";
  }
  binary = new Type2("tag:yaml.org,2002:binary", {
    kind: "scalar",
    resolve: resolveYamlBinary,
    construct: constructYamlBinary,
    predicate: isBinary,
    represent: representYamlBinary
  });
  return binary;
}
var omap;
var hasRequiredOmap;
function requireOmap() {
  if (hasRequiredOmap)
    return omap;
  hasRequiredOmap = 1;
  const Type2 = requireType();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const _toString = Object.prototype.toString;
  function resolveYamlOmap(data) {
    if (data === null)
      return true;
    const objectKeys = {};
    const object = data;
    for (let index = 0, length = object.length;index < length; index += 1) {
      const pair = object[index];
      let pairHasKey = false;
      if (_toString.call(pair) !== "[object Object]")
        return false;
      let pairKey;
      for (pairKey in pair) {
        if (_hasOwnProperty.call(pair, pairKey)) {
          if (!pairHasKey)
            pairHasKey = true;
          else
            return false;
        }
      }
      if (!pairHasKey)
        return false;
      if (_hasOwnProperty.call(objectKeys, pairKey))
        return false;
      Object.defineProperty(objectKeys, pairKey, { value: true });
    }
    return true;
  }
  function constructYamlOmap(data) {
    return data !== null ? data : [];
  }
  omap = new Type2("tag:yaml.org,2002:omap", {
    kind: "sequence",
    resolve: resolveYamlOmap,
    construct: constructYamlOmap
  });
  return omap;
}
var pairs;
var hasRequiredPairs;
function requirePairs() {
  if (hasRequiredPairs)
    return pairs;
  hasRequiredPairs = 1;
  const Type2 = requireType();
  const _toString = Object.prototype.toString;
  function resolveYamlPairs(data) {
    if (data === null)
      return true;
    const object = data;
    const result = new Array(object.length);
    for (let index = 0, length = object.length;index < length; index += 1) {
      const pair = object[index];
      if (_toString.call(pair) !== "[object Object]")
        return false;
      const keys = Object.keys(pair);
      if (keys.length !== 1)
        return false;
      result[index] = [keys[0], pair[keys[0]]];
    }
    return true;
  }
  function constructYamlPairs(data) {
    if (data === null)
      return [];
    const object = data;
    const result = new Array(object.length);
    for (let index = 0, length = object.length;index < length; index += 1) {
      const pair = object[index];
      const keys = Object.keys(pair);
      result[index] = [keys[0], pair[keys[0]]];
    }
    return result;
  }
  pairs = new Type2("tag:yaml.org,2002:pairs", {
    kind: "sequence",
    resolve: resolveYamlPairs,
    construct: constructYamlPairs
  });
  return pairs;
}
var set;
var hasRequiredSet;
function requireSet() {
  if (hasRequiredSet)
    return set;
  hasRequiredSet = 1;
  const Type2 = requireType();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  function resolveYamlSet(data) {
    if (data === null)
      return true;
    const object = data;
    for (const key in object) {
      if (_hasOwnProperty.call(object, key)) {
        if (object[key] !== null)
          return false;
      }
    }
    return true;
  }
  function constructYamlSet(data) {
    return data !== null ? data : {};
  }
  set = new Type2("tag:yaml.org,2002:set", {
    kind: "mapping",
    resolve: resolveYamlSet,
    construct: constructYamlSet
  });
  return set;
}
var _default;
var hasRequired_default;
function require_default() {
  if (hasRequired_default)
    return _default;
  hasRequired_default = 1;
  _default = requireCore().extend({
    implicit: [
      requireTimestamp(),
      requireMerge()
    ],
    explicit: [
      requireBinary(),
      requireOmap(),
      requirePairs(),
      requireSet()
    ]
  });
  return _default;
}
var hasRequiredLoader;
function requireLoader() {
  if (hasRequiredLoader)
    return loader;
  hasRequiredLoader = 1;
  const common2 = requireCommon();
  const YAMLException2 = requireException();
  const makeSnippet = requireSnippet();
  const DEFAULT_SCHEMA2 = require_default();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const CONTEXT_FLOW_IN = 1;
  const CONTEXT_FLOW_OUT = 2;
  const CONTEXT_BLOCK_IN = 3;
  const CONTEXT_BLOCK_OUT = 4;
  const CHOMPING_CLIP = 1;
  const CHOMPING_STRIP = 2;
  const CHOMPING_KEEP = 3;
  const PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  const PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
  const PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
  const PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
  const PATTERN_TAG_URI = /^(?:!|[^,\[\]{}])(?:%[0-9a-f]{2}|[0-9a-z\-#;/?:@&=+$,_.!~*'()\[\]])*$/i;
  function _class(obj) {
    return Object.prototype.toString.call(obj);
  }
  function isEol(c) {
    return c === 10 || c === 13;
  }
  function isWhiteSpace(c) {
    return c === 9 || c === 32;
  }
  function isWsOrEol(c) {
    return c === 9 || c === 32 || c === 10 || c === 13;
  }
  function isFlowIndicator(c) {
    return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
  }
  function fromHexCode(c) {
    if (c >= 48 && c <= 57) {
      return c - 48;
    }
    const lc = c | 32;
    if (lc >= 97 && lc <= 102) {
      return lc - 97 + 10;
    }
    return -1;
  }
  function escapedHexLen(c) {
    if (c === 120) {
      return 2;
    }
    if (c === 117) {
      return 4;
    }
    if (c === 85) {
      return 8;
    }
    return 0;
  }
  function fromDecimalCode(c) {
    if (c >= 48 && c <= 57) {
      return c - 48;
    }
    return -1;
  }
  function simpleEscapeSequence(c) {
    switch (c) {
      case 48:
        return "\x00";
      case 97:
        return "\x07";
      case 98:
        return "\b";
      case 116:
        return "\t";
      case 9:
        return "\t";
      case 110:
        return `
`;
      case 118:
        return "\v";
      case 102:
        return "\f";
      case 114:
        return "\r";
      case 101:
        return "\x1B";
      case 32:
        return " ";
      case 34:
        return '"';
      case 47:
        return "/";
      case 92:
        return "\\";
      case 78:
        return "";
      case 95:
        return " ";
      case 76:
        return "\u2028";
      case 80:
        return "\u2029";
      default:
        return "";
    }
  }
  function charFromCodepoint(c) {
    if (c <= 65535) {
      return String.fromCharCode(c);
    }
    return String.fromCharCode((c - 65536 >> 10) + 55296, (c - 65536 & 1023) + 56320);
  }
  function setProperty(object, key, value) {
    if (key === "__proto__") {
      Object.defineProperty(object, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value
      });
    } else {
      object[key] = value;
    }
  }
  const simpleEscapeCheck = new Array(256);
  const simpleEscapeMap = new Array(256);
  for (let i = 0;i < 256; i++) {
    simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
    simpleEscapeMap[i] = simpleEscapeSequence(i);
  }
  function State(input, options) {
    this.input = input;
    this.filename = options["filename"] || null;
    this.schema = options["schema"] || DEFAULT_SCHEMA2;
    this.onWarning = options["onWarning"] || null;
    this.legacy = options["legacy"] || false;
    this.json = options["json"] || false;
    this.listener = options["listener"] || null;
    this.maxDepth = typeof options["maxDepth"] === "number" ? options["maxDepth"] : 100;
    this.maxTotalMergeKeys = typeof options["maxTotalMergeKeys"] === "number" ? options["maxTotalMergeKeys"] : 1e4;
    this.implicitTypes = this.schema.compiledImplicit;
    this.typeMap = this.schema.compiledTypeMap;
    this.length = input.length;
    this.position = 0;
    this.line = 0;
    this.lineStart = 0;
    this.lineIndent = 0;
    this.depth = 0;
    this.totalMergeKeys = 0;
    this.firstTabInLine = -1;
    this.documents = [];
    this.anchorMapTransactions = [];
  }
  function generateError(state, message) {
    const mark = {
      name: state.filename,
      buffer: state.input.slice(0, -1),
      position: state.position,
      line: state.line,
      column: state.position - state.lineStart
    };
    mark.snippet = makeSnippet(mark);
    return new YAMLException2(message, mark);
  }
  function throwError(state, message) {
    throw generateError(state, message);
  }
  function throwWarning(state, message) {
    if (state.onWarning) {
      state.onWarning.call(null, generateError(state, message));
    }
  }
  function storeAnchor(state, name, value) {
    const transactions = state.anchorMapTransactions;
    if (transactions.length !== 0) {
      const transaction = transactions[transactions.length - 1];
      if (!_hasOwnProperty.call(transaction, name)) {
        transaction[name] = {
          existed: _hasOwnProperty.call(state.anchorMap, name),
          value: state.anchorMap[name]
        };
      }
    }
    state.anchorMap[name] = value;
  }
  function beginAnchorTransaction(state) {
    state.anchorMapTransactions.push(/* @__PURE__ */ Object.create(null));
  }
  function commitAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const transactions = state.anchorMapTransactions;
    if (transactions.length === 0)
      return;
    const parent = transactions[transactions.length - 1];
    const names = Object.keys(transaction);
    for (let index = 0, length = names.length;index < length; index += 1) {
      const name = names[index];
      if (!_hasOwnProperty.call(parent, name)) {
        parent[name] = transaction[name];
      }
    }
  }
  function rollbackAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const names = Object.keys(transaction);
    for (let index = names.length - 1;index >= 0; index -= 1) {
      const entry = transaction[names[index]];
      if (entry.existed) {
        state.anchorMap[names[index]] = entry.value;
      } else {
        delete state.anchorMap[names[index]];
      }
    }
  }
  function snapshotState(state) {
    return {
      position: state.position,
      line: state.line,
      lineStart: state.lineStart,
      lineIndent: state.lineIndent,
      firstTabInLine: state.firstTabInLine,
      tag: state.tag,
      anchor: state.anchor,
      kind: state.kind,
      result: state.result
    };
  }
  function restoreState(state, snapshot) {
    state.position = snapshot.position;
    state.line = snapshot.line;
    state.lineStart = snapshot.lineStart;
    state.lineIndent = snapshot.lineIndent;
    state.firstTabInLine = snapshot.firstTabInLine;
    state.tag = snapshot.tag;
    state.anchor = snapshot.anchor;
    state.kind = snapshot.kind;
    state.result = snapshot.result;
  }
  const directiveHandlers = {
    YAML: function handleYamlDirective(state, name, args) {
      if (state.version !== null) {
        throwError(state, "duplication of %YAML directive");
      }
      if (args.length !== 1) {
        throwError(state, "YAML directive accepts exactly one argument");
      }
      const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
      if (match === null) {
        throwError(state, "ill-formed argument of the YAML directive");
      }
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      if (major !== 1) {
        throwError(state, "unacceptable YAML version of the document");
      }
      state.version = args[0];
      state.checkLineBreaks = minor < 2;
      if (minor !== 1 && minor !== 2) {
        throwWarning(state, "unsupported YAML version of the document");
      }
    },
    TAG: function handleTagDirective(state, name, args) {
      let prefix;
      if (args.length !== 2) {
        throwError(state, "TAG directive accepts exactly two arguments");
      }
      const handle = args[0];
      prefix = args[1];
      if (!PATTERN_TAG_HANDLE.test(handle)) {
        throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
      }
      if (_hasOwnProperty.call(state.tagMap, handle)) {
        throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
      }
      if (!PATTERN_TAG_URI.test(prefix)) {
        throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
      }
      try {
        prefix = decodeURIComponent(prefix);
      } catch (err) {
        throwError(state, "tag prefix is malformed: " + prefix);
      }
      state.tagMap[handle] = prefix;
    }
  };
  function captureSegment(state, start, end, checkJson) {
    if (start < end) {
      const _result = state.input.slice(start, end);
      if (checkJson) {
        for (let _position = 0, _length = _result.length;_position < _length; _position += 1) {
          const _character = _result.charCodeAt(_position);
          if (!(_character === 9 || _character >= 32 && _character <= 1114111)) {
            throwError(state, "expected valid JSON character");
          }
        }
      } else if (PATTERN_NON_PRINTABLE.test(_result)) {
        throwError(state, "the stream contains non-printable characters");
      }
      state.result += _result;
    }
  }
  function chargeMergeWork(state) {
    state.totalMergeKeys++;
    if (state.maxTotalMergeKeys !== -1 && state.totalMergeKeys > state.maxTotalMergeKeys) {
      throwError(state, "merge keys exceeded maxTotalMergeKeys (" + state.maxTotalMergeKeys + ")");
    }
  }
  function mergeMappings(state, destination, source, overridableKeys) {
    if (!common2.isObject(source)) {
      throwError(state, "cannot merge mappings; the provided source object is unacceptable");
    }
    chargeMergeWork(state);
    const sourceKeys = Object.keys(source);
    for (let index = 0, quantity = sourceKeys.length;index < quantity; index += 1) {
      const key = sourceKeys[index];
      chargeMergeWork(state);
      if (!_hasOwnProperty.call(destination, key)) {
        setProperty(destination, key, source[key]);
        overridableKeys[key] = true;
      }
    }
  }
  function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
    if (Array.isArray(keyNode)) {
      keyNode = Array.prototype.slice.call(keyNode);
      for (let index = 0, quantity = keyNode.length;index < quantity; index += 1) {
        if (Array.isArray(keyNode[index])) {
          throwError(state, "nested arrays are not supported inside keys");
        }
        if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
          keyNode[index] = "[object Object]";
        }
      }
    }
    if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
      keyNode = "[object Object]";
    }
    keyNode = String(keyNode);
    if (_result === null) {
      _result = {};
    }
    if (keyTag === "tag:yaml.org,2002:merge") {
      if (Array.isArray(valueNode)) {
        if (valueNode.length > 100) {
          throwError(state, "abnormal merge sequence size");
        }
        for (let index = 0, quantity = valueNode.length;index < quantity; index += 1) {
          mergeMappings(state, _result, valueNode[index], overridableKeys);
        }
      } else {
        mergeMappings(state, _result, valueNode, overridableKeys);
      }
    } else {
      if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
        state.line = startLine || state.line;
        state.lineStart = startLineStart || state.lineStart;
        state.position = startPos || state.position;
        throwError(state, "duplicated mapping key");
      }
      setProperty(_result, keyNode, valueNode);
      delete overridableKeys[keyNode];
    }
    return _result;
  }
  function readLineBreak(state) {
    const ch = state.input.charCodeAt(state.position);
    if (ch === 10) {
      state.position++;
    } else if (ch === 13) {
      state.position++;
      if (state.input.charCodeAt(state.position) === 10) {
        state.position++;
      }
    } else {
      throwError(state, "a line break is expected");
    }
    state.line += 1;
    state.lineStart = state.position;
    state.firstTabInLine = -1;
  }
  function skipSeparationSpace(state, allowComments, checkIndent) {
    let lineBreaks = 0;
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      while (isWhiteSpace(ch)) {
        if (ch === 9 && state.firstTabInLine === -1) {
          state.firstTabInLine = state.position;
        }
        ch = state.input.charCodeAt(++state.position);
      }
      if (allowComments && ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 10 && ch !== 13 && ch !== 0);
      }
      if (isEol(ch)) {
        readLineBreak(state);
        ch = state.input.charCodeAt(state.position);
        lineBreaks++;
        state.lineIndent = 0;
        while (ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
      } else {
        break;
      }
    }
    if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
      throwWarning(state, "deficient indentation");
    }
    return lineBreaks;
  }
  function testDocumentSeparator(state) {
    let _position = state.position;
    let ch = state.input.charCodeAt(_position);
    if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
      _position += 3;
      ch = state.input.charCodeAt(_position);
      if (ch === 0 || isWsOrEol(ch)) {
        return true;
      }
    }
    return false;
  }
  function writeFoldedLines(state, count) {
    if (count === 1) {
      state.result += " ";
    } else if (count > 1) {
      state.result += common2.repeat(`
`, count - 1);
    }
  }
  function readPlainScalar(state, nodeIndent, withinFlowCollection) {
    let captureStart;
    let captureEnd;
    let hasPendingContent;
    let _line;
    let _lineStart;
    let _lineIndent;
    const _kind = state.kind;
    const _result = state.result;
    let ch = state.input.charCodeAt(state.position);
    if (isWsOrEol(ch) || isFlowIndicator(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
      return false;
    }
    if (ch === 63 || ch === 45) {
      const following = state.input.charCodeAt(state.position + 1);
      if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
        return false;
      }
    }
    state.kind = "scalar";
    state.result = "";
    captureStart = captureEnd = state.position;
    hasPendingContent = false;
    while (ch !== 0) {
      if (ch === 58) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
          break;
        }
      } else if (ch === 35) {
        const preceding = state.input.charCodeAt(state.position - 1);
        if (isWsOrEol(preceding)) {
          break;
        }
      } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && isFlowIndicator(ch)) {
        break;
      } else if (isEol(ch)) {
        _line = state.line;
        _lineStart = state.lineStart;
        _lineIndent = state.lineIndent;
        skipSeparationSpace(state, false, -1);
        if (state.lineIndent >= nodeIndent) {
          hasPendingContent = true;
          ch = state.input.charCodeAt(state.position);
          continue;
        } else {
          state.position = captureEnd;
          state.line = _line;
          state.lineStart = _lineStart;
          state.lineIndent = _lineIndent;
          break;
        }
      }
      if (hasPendingContent) {
        captureSegment(state, captureStart, captureEnd, false);
        writeFoldedLines(state, state.line - _line);
        captureStart = captureEnd = state.position;
        hasPendingContent = false;
      }
      if (!isWhiteSpace(ch)) {
        captureEnd = state.position + 1;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, captureEnd, false);
    if (state.result) {
      return true;
    }
    state.kind = _kind;
    state.result = _result;
    return false;
  }
  function readSingleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 39) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 39) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (ch === 39) {
          captureStart = state.position;
          state.position++;
          captureEnd = state.position;
        } else {
          return true;
        }
      } else if (isEol(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a single quoted scalar");
      } else {
        state.position++;
        if (!isWhiteSpace(ch)) {
          captureEnd = state.position;
        }
      }
    }
    throwError(state, "unexpected end of the stream within a single quoted scalar");
  }
  function readDoubleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 34) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 34) {
        captureSegment(state, captureStart, state.position, true);
        state.position++;
        return true;
      } else if (ch === 92) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (isEol(ch)) {
          skipSeparationSpace(state, false, nodeIndent);
        } else if (ch < 256 && simpleEscapeCheck[ch]) {
          state.result += simpleEscapeMap[ch];
          state.position++;
        } else if ((tmp = escapedHexLen(ch)) > 0) {
          let hexLength = tmp;
          let hexResult = 0;
          for (;hexLength > 0; hexLength--) {
            ch = state.input.charCodeAt(++state.position);
            if ((tmp = fromHexCode(ch)) >= 0) {
              hexResult = (hexResult << 4) + tmp;
            } else {
              throwError(state, "expected hexadecimal character");
            }
          }
          state.result += charFromCodepoint(hexResult);
          state.position++;
        } else {
          throwError(state, "unknown escape sequence");
        }
        captureStart = captureEnd = state.position;
      } else if (isEol(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a double quoted scalar");
      } else {
        state.position++;
        if (!isWhiteSpace(ch)) {
          captureEnd = state.position;
        }
      }
    }
    throwError(state, "unexpected end of the stream within a double quoted scalar");
  }
  function readFlowCollection(state, nodeIndent) {
    let readNext = true;
    let _line;
    let _lineStart;
    let _pos;
    const _tag = state.tag;
    let _result;
    const _anchor = state.anchor;
    let terminator;
    let isPair;
    let isExplicitPair;
    let isMapping;
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyNode;
    let keyTag;
    let valueNode;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 91) {
      terminator = 93;
      isMapping = false;
      _result = [];
    } else if (ch === 123) {
      terminator = 125;
      isMapping = true;
      _result = {};
    } else {
      return false;
    }
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    ch = state.input.charCodeAt(++state.position);
    while (ch !== 0) {
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === terminator) {
        state.position++;
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = isMapping ? "mapping" : "sequence";
        state.result = _result;
        return true;
      } else if (!readNext) {
        throwError(state, "missed comma between flow collection entries");
      } else if (ch === 44) {
        throwError(state, "expected the node content, but found ','");
      }
      keyTag = keyNode = valueNode = null;
      isPair = isExplicitPair = false;
      if (ch === 63) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following)) {
          isPair = isExplicitPair = true;
          state.position++;
          skipSeparationSpace(state, true, nodeIndent);
        }
      }
      _line = state.line;
      _lineStart = state.lineStart;
      _pos = state.position;
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      keyTag = state.tag;
      keyNode = state.result;
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if ((isExplicitPair || state.line === _line) && ch === 58) {
        isPair = true;
        ch = state.input.charCodeAt(++state.position);
        skipSeparationSpace(state, true, nodeIndent);
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        valueNode = state.result;
      }
      if (isMapping) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
      } else if (isPair) {
        _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
      } else {
        _result.push(keyNode);
      }
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === 44) {
        readNext = true;
        ch = state.input.charCodeAt(++state.position);
      } else {
        readNext = false;
      }
    }
    throwError(state, "unexpected end of the stream within a flow collection");
  }
  function readBlockScalar(state, nodeIndent) {
    let folding;
    let chomping = CHOMPING_CLIP;
    let didReadContent = false;
    let detectedIndent = false;
    let textIndent = nodeIndent;
    let emptyLines = 0;
    let atMoreIndented = false;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 124) {
      folding = false;
    } else if (ch === 62) {
      folding = true;
    } else {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    while (ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
      if (ch === 43 || ch === 45) {
        if (CHOMPING_CLIP === chomping) {
          chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
        } else {
          throwError(state, "repeat of a chomping mode identifier");
        }
      } else if ((tmp = fromDecimalCode(ch)) >= 0) {
        if (tmp === 0) {
          throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
        } else if (!detectedIndent) {
          textIndent = nodeIndent + tmp - 1;
          detectedIndent = true;
        } else {
          throwError(state, "repeat of an indentation width identifier");
        }
      } else {
        break;
      }
    }
    if (isWhiteSpace(ch)) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (isWhiteSpace(ch));
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (!isEol(ch) && ch !== 0);
      }
    }
    while (ch !== 0) {
      readLineBreak(state);
      state.lineIndent = 0;
      ch = state.input.charCodeAt(state.position);
      while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
      if (!detectedIndent && state.lineIndent > textIndent) {
        textIndent = state.lineIndent;
      }
      if (isEol(ch)) {
        emptyLines++;
        continue;
      }
      if (!detectedIndent && textIndent === 0) {
        throwError(state, "missing indentation for block scalar");
      }
      if (state.lineIndent < textIndent) {
        if (chomping === CHOMPING_KEEP) {
          state.result += common2.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
        } else if (chomping === CHOMPING_CLIP) {
          if (didReadContent) {
            state.result += `
`;
          }
        }
        break;
      }
      if (folding) {
        if (isWhiteSpace(ch)) {
          atMoreIndented = true;
          state.result += common2.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
        } else if (atMoreIndented) {
          atMoreIndented = false;
          state.result += common2.repeat(`
`, emptyLines + 1);
        } else if (emptyLines === 0) {
          if (didReadContent) {
            state.result += " ";
          }
        } else {
          state.result += common2.repeat(`
`, emptyLines);
        }
      } else {
        state.result += common2.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
      }
      didReadContent = true;
      detectedIndent = true;
      emptyLines = 0;
      const captureStart = state.position;
      while (!isEol(ch) && ch !== 0) {
        ch = state.input.charCodeAt(++state.position);
      }
      captureSegment(state, captureStart, state.position, false);
    }
    return true;
  }
  function readBlockSequence(state, nodeIndent) {
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = [];
    let detected = false;
    if (state.firstTabInLine !== -1)
      return false;
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      if (ch !== 45) {
        break;
      }
      const following = state.input.charCodeAt(state.position + 1);
      if (!isWsOrEol(following)) {
        break;
      }
      detected = true;
      state.position++;
      if (skipSeparationSpace(state, true, -1)) {
        if (state.lineIndent <= nodeIndent) {
          _result.push(null);
          ch = state.input.charCodeAt(state.position);
          continue;
        }
      }
      const _line = state.line;
      composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
      _result.push(state.result);
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a sequence entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "sequence";
      state.result = _result;
      return true;
    }
    return false;
  }
  function readBlockMapping(state, nodeIndent, flowIndent) {
    let allowCompact;
    let _keyLine;
    let _keyLineStart;
    let _keyPos;
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = {};
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyTag = null;
    let keyNode = null;
    let valueNode = null;
    let atExplicitKey = false;
    let detected = false;
    if (state.firstTabInLine !== -1)
      return false;
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (!atExplicitKey && state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      const following = state.input.charCodeAt(state.position + 1);
      const _line = state.line;
      if ((ch === 63 || ch === 58) && isWsOrEol(following)) {
        if (ch === 63) {
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = true;
          allowCompact = true;
        } else if (atExplicitKey) {
          atExplicitKey = false;
          allowCompact = true;
        } else {
          throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
        }
        state.position += 1;
        ch = following;
      } else {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
        if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
          break;
        }
        if (state.line === _line) {
          ch = state.input.charCodeAt(state.position);
          while (isWhiteSpace(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          if (ch === 58) {
            ch = state.input.charCodeAt(++state.position);
            if (!isWsOrEol(ch)) {
              throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
            }
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = false;
            allowCompact = false;
            keyTag = state.tag;
            keyNode = state.result;
          } else if (detected) {
            throwError(state, "can not read an implicit mapping pair; a colon is missed");
          } else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        } else if (detected) {
          throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      }
      if (state.line === _line || state.lineIndent > nodeIndent) {
        if (atExplicitKey) {
          _keyLine = state.line;
          _keyLineStart = state.lineStart;
          _keyPos = state.position;
        }
        if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
          if (atExplicitKey) {
            keyNode = state.result;
          } else {
            valueNode = state.result;
          }
        }
        if (!atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
      }
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a mapping entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (atExplicitKey) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "mapping";
      state.result = _result;
    }
    return detected;
  }
  function readTagProperty(state) {
    let isVerbatim = false;
    let isNamed = false;
    let tagHandle;
    let tagName;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 33)
      return false;
    if (state.tag !== null) {
      throwError(state, "duplication of a tag property");
    }
    ch = state.input.charCodeAt(++state.position);
    if (ch === 60) {
      isVerbatim = true;
      ch = state.input.charCodeAt(++state.position);
    } else if (ch === 33) {
      isNamed = true;
      tagHandle = "!!";
      ch = state.input.charCodeAt(++state.position);
    } else {
      tagHandle = "!";
    }
    let _position = state.position;
    if (isVerbatim) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 0 && ch !== 62);
      if (state.position < state.length) {
        tagName = state.input.slice(_position, state.position);
        ch = state.input.charCodeAt(++state.position);
      } else {
        throwError(state, "unexpected end of the stream within a verbatim tag");
      }
    } else {
      while (ch !== 0 && !isWsOrEol(ch)) {
        if (ch === 33) {
          if (!isNamed) {
            tagHandle = state.input.slice(_position - 1, state.position + 1);
            if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
              throwError(state, "named tag handle cannot contain such characters");
            }
            isNamed = true;
            _position = state.position + 1;
          } else {
            throwError(state, "tag suffix cannot contain exclamation marks");
          }
        }
        ch = state.input.charCodeAt(++state.position);
      }
      tagName = state.input.slice(_position, state.position);
      if (PATTERN_FLOW_INDICATORS.test(tagName)) {
        throwError(state, "tag suffix cannot contain flow indicator characters");
      }
    }
    if (tagName && !PATTERN_TAG_URI.test(tagName)) {
      throwError(state, "tag name cannot contain such characters: " + tagName);
    }
    try {
      tagName = decodeURIComponent(tagName);
    } catch (err) {
      throwError(state, "tag name is malformed: " + tagName);
    }
    if (isVerbatim) {
      state.tag = tagName;
    } else if (_hasOwnProperty.call(state.tagMap, tagHandle)) {
      state.tag = state.tagMap[tagHandle] + tagName;
    } else if (tagHandle === "!") {
      state.tag = "!" + tagName;
    } else if (tagHandle === "!!") {
      state.tag = "tag:yaml.org,2002:" + tagName;
    } else {
      throwError(state, 'undeclared tag handle "' + tagHandle + '"');
    }
    return true;
  }
  function readAnchorProperty(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 38)
      return false;
    if (state.anchor !== null) {
      throwError(state, "duplication of an anchor property");
    }
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an anchor node must contain at least one character");
    }
    state.anchor = state.input.slice(_position, state.position);
    return true;
  }
  function readAlias(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 42)
      return false;
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an alias node must contain at least one character");
    }
    const alias = state.input.slice(_position, state.position);
    if (!_hasOwnProperty.call(state.anchorMap, alias)) {
      throwError(state, 'unidentified alias "' + alias + '"');
    }
    state.result = state.anchorMap[alias];
    skipSeparationSpace(state, true, -1);
    return true;
  }
  function tryReadBlockMappingFromProperty(state, propertyStart, nodeIndent, flowIndent) {
    const fallbackState = snapshotState(state);
    beginAnchorTransaction(state);
    restoreState(state, propertyStart);
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    if (readBlockMapping(state, nodeIndent, flowIndent) && state.kind === "mapping") {
      commitAnchorTransaction(state);
      return true;
    }
    rollbackAnchorTransaction(state);
    restoreState(state, fallbackState);
    return false;
  }
  function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
    let allowBlockScalars;
    let allowBlockCollections;
    let indentStatus = 1;
    let atNewLine = false;
    let hasContent = false;
    let propertyStart = null;
    let type2;
    let flowIndent;
    let blockIndent;
    if (state.depth >= state.maxDepth) {
      throwError(state, "nesting exceeded maxDepth (" + state.maxDepth + ")");
    }
    state.depth += 1;
    if (state.listener !== null) {
      state.listener("open", state);
    }
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    const allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
    if (allowToSeek) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      }
    }
    if (indentStatus === 1) {
      while (true) {
        const ch = state.input.charCodeAt(state.position);
        const propertyState = snapshotState(state);
        if (atNewLine && (ch === 33 && state.tag !== null || ch === 38 && state.anchor !== null)) {
          break;
        }
        if (!readTagProperty(state) && !readAnchorProperty(state)) {
          break;
        }
        if (propertyStart === null) {
          propertyStart = propertyState;
        }
        if (skipSeparationSpace(state, true, -1)) {
          atNewLine = true;
          allowBlockCollections = allowBlockStyles;
          if (state.lineIndent > parentIndent) {
            indentStatus = 1;
          } else if (state.lineIndent === parentIndent) {
            indentStatus = 0;
          } else if (state.lineIndent < parentIndent) {
            indentStatus = -1;
          }
        } else {
          allowBlockCollections = false;
        }
      }
    }
    if (allowBlockCollections) {
      allowBlockCollections = atNewLine || allowCompact;
    }
    if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
      if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
        flowIndent = parentIndent;
      } else {
        flowIndent = parentIndent + 1;
      }
      blockIndent = state.position - state.lineStart;
      if (indentStatus === 1) {
        if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
          hasContent = true;
        } else {
          const ch = state.input.charCodeAt(state.position);
          if (propertyStart !== null && allowBlockStyles && !allowBlockCollections && ch !== 124 && ch !== 62 && tryReadBlockMappingFromProperty(state, propertyStart, propertyStart.position - propertyStart.lineStart, flowIndent)) {
            hasContent = true;
          } else if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
            hasContent = true;
          } else if (readAlias(state)) {
            hasContent = true;
            if (state.tag !== null || state.anchor !== null) {
              throwError(state, "alias node should not have any properties");
            }
          } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
            hasContent = true;
            if (state.tag === null) {
              state.tag = "?";
            }
          }
          if (state.anchor !== null) {
            storeAnchor(state, state.anchor, state.result);
          }
        }
      } else if (indentStatus === 0) {
        hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
      }
    }
    if (state.tag === null) {
      if (state.anchor !== null) {
        storeAnchor(state, state.anchor, state.result);
      }
    } else if (state.tag === "?") {
      if (state.result !== null && state.kind !== "scalar") {
        throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
      }
      for (let typeIndex = 0, typeQuantity = state.implicitTypes.length;typeIndex < typeQuantity; typeIndex += 1) {
        type2 = state.implicitTypes[typeIndex];
        if (type2.resolve(state.result)) {
          state.result = type2.construct(state.result);
          state.tag = type2.tag;
          if (state.anchor !== null) {
            storeAnchor(state, state.anchor, state.result);
          }
          break;
        }
      }
    } else if (state.tag !== "!") {
      if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) {
        type2 = state.typeMap[state.kind || "fallback"][state.tag];
      } else {
        type2 = null;
        const typeList = state.typeMap.multi[state.kind || "fallback"];
        for (let typeIndex = 0, typeQuantity = typeList.length;typeIndex < typeQuantity; typeIndex += 1) {
          if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
            type2 = typeList[typeIndex];
            break;
          }
        }
      }
      if (!type2) {
        throwError(state, "unknown tag !<" + state.tag + ">");
      }
      if (state.result !== null && type2.kind !== state.kind) {
        throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
      }
      if (!type2.resolve(state.result, state.tag)) {
        throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
      } else {
        state.result = type2.construct(state.result, state.tag);
        if (state.anchor !== null) {
          storeAnchor(state, state.anchor, state.result);
        }
      }
    }
    if (state.listener !== null) {
      state.listener("close", state);
    }
    state.depth -= 1;
    return state.tag !== null || state.anchor !== null || hasContent;
  }
  function readDocument(state) {
    const documentStart = state.position;
    let hasDirectives = false;
    let ch;
    state.version = null;
    state.checkLineBreaks = state.legacy;
    state.tagMap = /* @__PURE__ */ Object.create(null);
    state.anchorMap = /* @__PURE__ */ Object.create(null);
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if (state.lineIndent > 0 || ch !== 37) {
        break;
      }
      hasDirectives = true;
      ch = state.input.charCodeAt(++state.position);
      let _position = state.position;
      while (ch !== 0 && !isWsOrEol(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      const directiveName = state.input.slice(_position, state.position);
      const directiveArgs = [];
      if (directiveName.length < 1) {
        throwError(state, "directive name must not be less than one character in length");
      }
      while (ch !== 0) {
        while (isWhiteSpace(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (ch !== 0 && !isEol(ch));
          break;
        }
        if (isEol(ch))
          break;
        _position = state.position;
        while (ch !== 0 && !isWsOrEol(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        directiveArgs.push(state.input.slice(_position, state.position));
      }
      if (ch !== 0)
        readLineBreak(state);
      if (_hasOwnProperty.call(directiveHandlers, directiveName)) {
        directiveHandlers[directiveName](state, directiveName, directiveArgs);
      } else {
        throwWarning(state, 'unknown document directive "' + directiveName + '"');
      }
    }
    skipSeparationSpace(state, true, -1);
    if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    } else if (hasDirectives) {
      throwError(state, "directives end mark is expected");
    }
    composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
    skipSeparationSpace(state, true, -1);
    if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
      throwWarning(state, "non-ASCII line breaks are interpreted as content");
    }
    state.documents.push(state.result);
    if (state.position === state.lineStart && testDocumentSeparator(state)) {
      if (state.input.charCodeAt(state.position) === 46) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      }
      return;
    }
    if (state.position < state.length - 1) {
      throwError(state, "end of the stream or a document separator is expected");
    }
  }
  function loadDocuments(input, options) {
    input = String(input);
    options = options || {};
    if (input.length !== 0) {
      if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
        input += `
`;
      }
      if (input.charCodeAt(0) === 65279) {
        input = input.slice(1);
      }
    }
    const state = new State(input, options);
    const nullpos = input.indexOf("\x00");
    if (nullpos !== -1) {
      state.position = nullpos;
      throwError(state, "null byte is not allowed in input");
    }
    state.input += "\x00";
    while (state.input.charCodeAt(state.position) === 32) {
      state.lineIndent += 1;
      state.position += 1;
    }
    while (state.position < state.length - 1) {
      readDocument(state);
    }
    return state.documents;
  }
  function loadAll2(input, iterator, options) {
    if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
      options = iterator;
      iterator = null;
    }
    const documents = loadDocuments(input, options);
    if (typeof iterator !== "function") {
      return documents;
    }
    for (let index = 0, length = documents.length;index < length; index += 1) {
      iterator(documents[index]);
    }
  }
  function load2(input, options) {
    const documents = loadDocuments(input, options);
    if (documents.length === 0) {
      return;
    } else if (documents.length === 1) {
      return documents[0];
    }
    throw new YAMLException2("expected a single document in the stream, but found more");
  }
  loader.loadAll = loadAll2;
  loader.load = load2;
  return loader;
}
var dumper = {};
var hasRequiredDumper;
function requireDumper() {
  if (hasRequiredDumper)
    return dumper;
  hasRequiredDumper = 1;
  const common2 = requireCommon();
  const YAMLException2 = requireException();
  const DEFAULT_SCHEMA2 = require_default();
  const _toString = Object.prototype.toString;
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const CHAR_BOM = 65279;
  const CHAR_TAB = 9;
  const CHAR_LINE_FEED = 10;
  const CHAR_CARRIAGE_RETURN = 13;
  const CHAR_SPACE = 32;
  const CHAR_EXCLAMATION = 33;
  const CHAR_DOUBLE_QUOTE = 34;
  const CHAR_SHARP = 35;
  const CHAR_PERCENT = 37;
  const CHAR_AMPERSAND = 38;
  const CHAR_SINGLE_QUOTE = 39;
  const CHAR_ASTERISK = 42;
  const CHAR_COMMA = 44;
  const CHAR_MINUS = 45;
  const CHAR_COLON = 58;
  const CHAR_EQUALS = 61;
  const CHAR_GREATER_THAN = 62;
  const CHAR_QUESTION = 63;
  const CHAR_COMMERCIAL_AT = 64;
  const CHAR_LEFT_SQUARE_BRACKET = 91;
  const CHAR_RIGHT_SQUARE_BRACKET = 93;
  const CHAR_GRAVE_ACCENT = 96;
  const CHAR_LEFT_CURLY_BRACKET = 123;
  const CHAR_VERTICAL_LINE = 124;
  const CHAR_RIGHT_CURLY_BRACKET = 125;
  const ESCAPE_SEQUENCES = {};
  ESCAPE_SEQUENCES[0] = "\\0";
  ESCAPE_SEQUENCES[7] = "\\a";
  ESCAPE_SEQUENCES[8] = "\\b";
  ESCAPE_SEQUENCES[9] = "\\t";
  ESCAPE_SEQUENCES[10] = "\\n";
  ESCAPE_SEQUENCES[11] = "\\v";
  ESCAPE_SEQUENCES[12] = "\\f";
  ESCAPE_SEQUENCES[13] = "\\r";
  ESCAPE_SEQUENCES[27] = "\\e";
  ESCAPE_SEQUENCES[34] = "\\\"";
  ESCAPE_SEQUENCES[92] = "\\\\";
  ESCAPE_SEQUENCES[133] = "\\N";
  ESCAPE_SEQUENCES[160] = "\\_";
  ESCAPE_SEQUENCES[8232] = "\\L";
  ESCAPE_SEQUENCES[8233] = "\\P";
  const DEPRECATED_BOOLEANS_SYNTAX = [
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF"
  ];
  const DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
  function compileStyleMap(schema2, map2) {
    if (map2 === null)
      return {};
    const result = {};
    const keys = Object.keys(map2);
    for (let index = 0, length = keys.length;index < length; index += 1) {
      let tag = keys[index];
      let style = String(map2[tag]);
      if (tag.slice(0, 2) === "!!") {
        tag = "tag:yaml.org,2002:" + tag.slice(2);
      }
      const type2 = schema2.compiledTypeMap["fallback"][tag];
      if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
        style = type2.styleAliases[style];
      }
      result[tag] = style;
    }
    return result;
  }
  function encodeHex(character) {
    let handle;
    let length;
    const string = character.toString(16).toUpperCase();
    if (character <= 255) {
      handle = "x";
      length = 2;
    } else if (character <= 65535) {
      handle = "u";
      length = 4;
    } else if (character <= 4294967295) {
      handle = "U";
      length = 8;
    } else {
      throw new YAMLException2("code point within a string may not be greater than 0xFFFFFFFF");
    }
    return "\\" + handle + common2.repeat("0", length - string.length) + string;
  }
  const QUOTING_TYPE_SINGLE = 1;
  const QUOTING_TYPE_DOUBLE = 2;
  function State(options) {
    this.schema = options["schema"] || DEFAULT_SCHEMA2;
    this.indent = Math.max(1, options["indent"] || 2);
    this.noArrayIndent = options["noArrayIndent"] || false;
    this.skipInvalid = options["skipInvalid"] || false;
    this.flowLevel = common2.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
    this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
    this.sortKeys = options["sortKeys"] || false;
    this.lineWidth = options["lineWidth"] || 80;
    this.noRefs = options["noRefs"] || false;
    this.noCompatMode = options["noCompatMode"] || false;
    this.condenseFlow = options["condenseFlow"] || false;
    this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
    this.forceQuotes = options["forceQuotes"] || false;
    this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.explicitTypes = this.schema.compiledExplicit;
    this.tag = null;
    this.result = "";
    this.duplicates = [];
    this.usedDuplicates = null;
  }
  function indentString(string, spaces) {
    const ind = common2.repeat(" ", spaces);
    let position = 0;
    let result = "";
    const length = string.length;
    while (position < length) {
      let line;
      const next = string.indexOf(`
`, position);
      if (next === -1) {
        line = string.slice(position);
        position = length;
      } else {
        line = string.slice(position, next + 1);
        position = next + 1;
      }
      if (line.length && line !== `
`)
        result += ind;
      result += line;
    }
    return result;
  }
  function generateNextLine(state, level) {
    return `
` + common2.repeat(" ", state.indent * level);
  }
  function testImplicitResolving(state, str2) {
    for (let index = 0, length = state.implicitTypes.length;index < length; index += 1) {
      const type2 = state.implicitTypes[index];
      if (type2.resolve(str2)) {
        return true;
      }
    }
    return false;
  }
  function isWhitespace(c) {
    return c === CHAR_SPACE || c === CHAR_TAB;
  }
  function isPrintable(c) {
    return c >= 32 && c <= 126 || c >= 161 && c <= 55295 && c !== 8232 && c !== 8233 || c >= 57344 && c <= 65533 && c !== CHAR_BOM || c >= 65536 && c <= 1114111;
  }
  function isNsCharOrWhitespace(c) {
    return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
  }
  function isPlainSafe(c, prev, inblock) {
    const cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
    const cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
    return (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && c !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar;
  }
  function isPlainSafeFirst(c) {
    return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
  }
  function isPlainSafeLast(c) {
    return !isWhitespace(c) && c !== CHAR_COLON;
  }
  function codePointAt(string, pos) {
    const first = string.charCodeAt(pos);
    let second;
    if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
      second = string.charCodeAt(pos + 1);
      if (second >= 56320 && second <= 57343) {
        return (first - 55296) * 1024 + second - 56320 + 65536;
      }
    }
    return first;
  }
  function needIndentIndicator(string) {
    const leadingSpaceRe = /^\n* /;
    return leadingSpaceRe.test(string);
  }
  const STYLE_PLAIN = 1;
  const STYLE_SINGLE = 2;
  const STYLE_LITERAL = 3;
  const STYLE_FOLDED = 4;
  const STYLE_DOUBLE = 5;
  function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
    let i;
    let char = 0;
    let prevChar = null;
    let hasLineBreak = false;
    let hasFoldableLine = false;
    const shouldTrackWidth = lineWidth !== -1;
    let previousLineBreak = -1;
    let plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
    if (singleLineOnly || forceQuotes) {
      for (i = 0;i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
    } else {
      for (i = 0;i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        if (char === CHAR_LINE_FEED) {
          hasLineBreak = true;
          if (shouldTrackWidth) {
            hasFoldableLine = hasFoldableLine || i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
            previousLineBreak = i;
          }
        } else if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
      hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
    }
    if (!hasLineBreak && !hasFoldableLine) {
      if (plain && !forceQuotes && !testAmbiguousType(string)) {
        return STYLE_PLAIN;
      }
      return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
    }
    if (indentPerLevel > 9 && needIndentIndicator(string)) {
      return STYLE_DOUBLE;
    }
    if (!forceQuotes) {
      return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  function writeScalar(state, string, level, iskey, inblock) {
    state.dump = function() {
      if (string.length === 0) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
      }
      if (!state.noCompatMode) {
        if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
          return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
        }
      }
      const indent = state.indent * Math.max(1, level);
      const lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
      const singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
      function testAmbiguity(string2) {
        return testImplicitResolving(state, string2);
      }
      switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth, testAmbiguity, state.quotingType, state.forceQuotes && !iskey, inblock)) {
        case STYLE_PLAIN:
          return string;
        case STYLE_SINGLE:
          return "'" + string.replace(/'/g, "''") + "'";
        case STYLE_LITERAL:
          return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
        case STYLE_FOLDED:
          return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
        case STYLE_DOUBLE:
          return '"' + escapeString(string) + '"';
        default:
          throw new YAMLException2("impossible error: invalid scalar style");
      }
    }();
  }
  function blockHeader(string, indentPerLevel) {
    const indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
    const clip = string[string.length - 1] === `
`;
    const keep = clip && (string[string.length - 2] === `
` || string === `
`);
    const chomp = keep ? "+" : clip ? "" : "-";
    return indentIndicator + chomp + `
`;
  }
  function dropEndingNewline(string) {
    return string[string.length - 1] === `
` ? string.slice(0, -1) : string;
  }
  function foldString(string, width) {
    const lineRe = /(\n+)([^\n]*)/g;
    let result = function() {
      let nextLF = string.indexOf(`
`);
      nextLF = nextLF !== -1 ? nextLF : string.length;
      lineRe.lastIndex = nextLF;
      return foldLine(string.slice(0, nextLF), width);
    }();
    let prevMoreIndented = string[0] === `
` || string[0] === " ";
    let moreIndented;
    let match;
    while (match = lineRe.exec(string)) {
      const prefix = match[1];
      const line = match[2];
      moreIndented = line[0] === " ";
      result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? `
` : "") + foldLine(line, width);
      prevMoreIndented = moreIndented;
    }
    return result;
  }
  function foldLine(line, width) {
    if (line === "" || line[0] === " ")
      return line;
    const breakRe = / [^ ]/g;
    let match;
    let start = 0;
    let end;
    let curr = 0;
    let next = 0;
    let result = "";
    while (match = breakRe.exec(line)) {
      next = match.index;
      if (next - start > width) {
        end = curr > start ? curr : next;
        result += `
` + line.slice(start, end);
        start = end + 1;
      }
      curr = next;
    }
    result += `
`;
    if (line.length - start > width && curr > start) {
      result += line.slice(start, curr) + `
` + line.slice(curr + 1);
    } else {
      result += line.slice(start);
    }
    return result.slice(1);
  }
  function escapeString(string) {
    let result = "";
    let char = 0;
    for (let i = 0;i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      const escapeSeq = ESCAPE_SEQUENCES[char];
      if (!escapeSeq && isPrintable(char)) {
        result += string[i];
        if (char >= 65536)
          result += string[i + 1];
      } else {
        result += escapeSeq || encodeHex(char);
      }
    }
    return result;
  }
  function writeFlowSequence(state, level, object) {
    let _result = "";
    const _tag = state.tag;
    for (let index = 0, length = object.length;index < length; index += 1) {
      let value = object[index];
      if (state.replacer) {
        value = state.replacer.call(object, String(index), value);
      }
      if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
        if (_result !== "")
          _result += "," + (!state.condenseFlow ? " " : "");
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = "[" + _result + "]";
  }
  function writeBlockSequence(state, level, object, compact) {
    let _result = "";
    const _tag = state.tag;
    for (let index = 0, length = object.length;index < length; index += 1) {
      let value = object[index];
      if (state.replacer) {
        value = state.replacer.call(object, String(index), value);
      }
      if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
        if (!compact || _result !== "") {
          _result += generateNextLine(state, level);
        }
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          _result += "-";
        } else {
          _result += "- ";
        }
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = _result || "[]";
  }
  function writeFlowMapping(state, level, object) {
    let _result = "";
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    for (let index = 0, length = objectKeyList.length;index < length; index += 1) {
      let pairBuffer = "";
      if (_result !== "")
        pairBuffer += ", ";
      if (state.condenseFlow)
        pairBuffer += '"';
      const objectKey = objectKeyList[index];
      let objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level, objectKey, false, false)) {
        continue;
      }
      if (state.dump.length > 1024)
        pairBuffer += "? ";
      pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
      if (!writeNode(state, level, objectValue, false, false)) {
        continue;
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = "{" + _result + "}";
  }
  function writeBlockMapping(state, level, object, compact) {
    let _result = "";
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    if (state.sortKeys === true) {
      objectKeyList.sort();
    } else if (typeof state.sortKeys === "function") {
      objectKeyList.sort(state.sortKeys);
    } else if (state.sortKeys) {
      throw new YAMLException2("sortKeys must be a boolean or a function");
    }
    for (let index = 0, length = objectKeyList.length;index < length; index += 1) {
      let pairBuffer = "";
      if (!compact || _result !== "") {
        pairBuffer += generateNextLine(state, level);
      }
      const objectKey = objectKeyList[index];
      let objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level + 1, objectKey, true, true, true)) {
        continue;
      }
      const explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
      if (explicitPair) {
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          pairBuffer += "?";
        } else {
          pairBuffer += "? ";
        }
      }
      pairBuffer += state.dump;
      if (explicitPair) {
        pairBuffer += generateNextLine(state, level);
      }
      if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
        continue;
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += ":";
      } else {
        pairBuffer += ": ";
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = _result || "{}";
  }
  function detectType(state, object, explicit) {
    const typeList = explicit ? state.explicitTypes : state.implicitTypes;
    for (let index = 0, length = typeList.length;index < length; index += 1) {
      const type2 = typeList[index];
      if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
        if (explicit) {
          if (type2.multi && type2.representName) {
            state.tag = type2.representName(object);
          } else {
            state.tag = type2.tag;
          }
        } else {
          state.tag = "?";
        }
        if (type2.represent) {
          const style = state.styleMap[type2.tag] || type2.defaultStyle;
          let _result;
          if (_toString.call(type2.represent) === "[object Function]") {
            _result = type2.represent(object, style);
          } else if (_hasOwnProperty.call(type2.represent, style)) {
            _result = type2.represent[style](object, style);
          } else {
            throw new YAMLException2("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
          }
          state.dump = _result;
        }
        return true;
      }
    }
    return false;
  }
  function writeNode(state, level, object, block, compact, iskey, isblockseq) {
    state.tag = null;
    state.dump = object;
    if (!detectType(state, object, false)) {
      detectType(state, object, true);
    }
    const type2 = _toString.call(state.dump);
    const inblock = block;
    if (block) {
      block = state.flowLevel < 0 || state.flowLevel > level;
    }
    const objectOrArray = type2 === "[object Object]" || type2 === "[object Array]";
    let duplicateIndex;
    let duplicate;
    if (objectOrArray) {
      duplicateIndex = state.duplicates.indexOf(object);
      duplicate = duplicateIndex !== -1;
    }
    if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
      compact = false;
    }
    if (duplicate && state.usedDuplicates[duplicateIndex]) {
      state.dump = "*ref_" + duplicateIndex;
    } else {
      if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
        state.usedDuplicates[duplicateIndex] = true;
      }
      if (type2 === "[object Object]") {
        if (block && Object.keys(state.dump).length !== 0) {
          writeBlockMapping(state, level, state.dump, compact);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowMapping(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type2 === "[object Array]") {
        if (block && state.dump.length !== 0) {
          if (state.noArrayIndent && !isblockseq && level > 0) {
            writeBlockSequence(state, level - 1, state.dump, compact);
          } else {
            writeBlockSequence(state, level, state.dump, compact);
          }
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowSequence(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type2 === "[object String]") {
        if (state.tag !== "?") {
          writeScalar(state, state.dump, level, iskey, inblock);
        }
      } else if (type2 === "[object Undefined]") {
        return false;
      } else {
        if (state.skipInvalid)
          return false;
        throw new YAMLException2("unacceptable kind of an object to dump " + type2);
      }
      if (state.tag !== null && state.tag !== "?") {
        let tagStr = encodeURI(state.tag[0] === "!" ? state.tag.slice(1) : state.tag).replace(/!/g, "%21");
        if (state.tag[0] === "!") {
          tagStr = "!" + tagStr;
        } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
          tagStr = "!!" + tagStr.slice(18);
        } else {
          tagStr = "!<" + tagStr + ">";
        }
        state.dump = tagStr + " " + state.dump;
      }
    }
    return true;
  }
  function getDuplicateReferences(object, state) {
    const objects = [];
    const duplicatesIndexes = [];
    inspectNode(object, objects, duplicatesIndexes);
    const length = duplicatesIndexes.length;
    for (let index = 0;index < length; index += 1) {
      state.duplicates.push(objects[duplicatesIndexes[index]]);
    }
    state.usedDuplicates = new Array(length);
  }
  function inspectNode(object, objects, duplicatesIndexes) {
    if (object !== null && typeof object === "object") {
      const index = objects.indexOf(object);
      if (index !== -1) {
        if (duplicatesIndexes.indexOf(index) === -1) {
          duplicatesIndexes.push(index);
        }
      } else {
        objects.push(object);
        if (Array.isArray(object)) {
          for (let i = 0, length = object.length;i < length; i += 1) {
            inspectNode(object[i], objects, duplicatesIndexes);
          }
        } else {
          const objectKeyList = Object.keys(object);
          for (let i = 0, length = objectKeyList.length;i < length; i += 1) {
            inspectNode(object[objectKeyList[i]], objects, duplicatesIndexes);
          }
        }
      }
    }
  }
  function dump2(input, options) {
    options = options || {};
    const state = new State(options);
    if (!state.noRefs)
      getDuplicateReferences(input, state);
    let value = input;
    if (state.replacer) {
      value = state.replacer.call({ "": value }, "", value);
    }
    if (writeNode(state, 0, value, true, true))
      return state.dump + `
`;
    return "";
  }
  dumper.dump = dump2;
  return dumper;
}
var hasRequiredJsYaml;
function requireJsYaml() {
  if (hasRequiredJsYaml)
    return jsYaml;
  hasRequiredJsYaml = 1;
  const loader2 = requireLoader();
  const dumper2 = requireDumper();
  function renamed(from, to) {
    return function() {
      throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
    };
  }
  jsYaml.Type = requireType();
  jsYaml.Schema = requireSchema();
  jsYaml.FAILSAFE_SCHEMA = requireFailsafe();
  jsYaml.JSON_SCHEMA = requireJson();
  jsYaml.CORE_SCHEMA = requireCore();
  jsYaml.DEFAULT_SCHEMA = require_default();
  jsYaml.load = loader2.load;
  jsYaml.loadAll = loader2.loadAll;
  jsYaml.dump = dumper2.dump;
  jsYaml.YAMLException = requireException();
  jsYaml.types = {
    binary: requireBinary(),
    float: requireFloat(),
    map: requireMap(),
    null: require_null(),
    pairs: requirePairs(),
    set: requireSet(),
    timestamp: requireTimestamp(),
    bool: requireBool(),
    int: requireInt(),
    merge: requireMerge(),
    omap: requireOmap(),
    seq: requireSeq(),
    str: requireStr()
  };
  jsYaml.safeLoad = renamed("safeLoad", "load");
  jsYaml.safeLoadAll = renamed("safeLoadAll", "loadAll");
  jsYaml.safeDump = renamed("safeDump", "dump");
  return jsYaml;
}
var jsYamlExports = requireJsYaml();
var yaml = /* @__PURE__ */ getDefaultExportFromCjs(jsYamlExports);

// src/core/clarify-md.ts
function normalizeHeading(text) {
  return text.trim().replace(/[:：]\s*$/, "").replace(/^\d+\s*[.、)）]\s*/, "").replace(/^[一二三四五六七八九十]+\s*[、.]\s*/, "").trim();
}
function findBoundarySection(lines) {
  for (let i = 0;i < lines.length; i++) {
    const m = lines[i].match(/^\s{0,3}(#{1,6})\s+(.*)$/);
    if (!m)
      continue;
    if (!normalizeHeading(m[2]).startsWith("执行边界"))
      continue;
    const level = m[1].length;
    let end = lines.length;
    for (let j = i + 1;j < lines.length; j++) {
      const next = lines[j].match(/^\s{0,3}(#{1,6})\s+/);
      if (next && next[1].length <= level) {
        end = j;
        break;
      }
    }
    return { start: i + 1, end };
  }
  return null;
}
function firstYamlFence(lines, start, end) {
  let bodyStart = -1;
  for (let i = start;i < end; i++) {
    const line = lines[i];
    if (bodyStart < 0) {
      if (/^\s*```\s*ya?ml\s*$/i.test(line))
        bodyStart = i + 1;
      continue;
    }
    if (/^\s*```\s*$/.test(line))
      return lines.slice(bodyStart, i).join(`
`);
  }
  return null;
}
function isNonEmptyStringArray(v) {
  return Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === "string" && s.trim() !== "");
}
function parseExecutionBoundary(content, taskGroupId) {
  if (typeof content !== "string" || content.trim() === "")
    return null;
  try {
    const lines = content.split(/\r?\n/);
    const section = findBoundarySection(lines);
    if (!section)
      return null;
    const yamlText = firstYamlFence(lines, section.start, section.end);
    if (yamlText === null)
      return null;
    const raw = yaml.load(yamlText);
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
      return null;
    const groups = raw["task_groups"];
    if (typeof groups !== "object" || groups === null || Array.isArray(groups))
      return null;
    const entry = groups[taskGroupId];
    if (typeof entry !== "object" || entry === null || Array.isArray(entry))
      return null;
    const rec = entry;
    const dirs = rec["allowed_directories"];
    const pkgs = rec["allowed_packages"];
    if (!isNonEmptyStringArray(dirs) || !isNonEmptyStringArray(pkgs))
      return null;
    const rawNotes = rec["notes"];
    if (rawNotes !== undefined && typeof rawNotes !== "string")
      return null;
    return {
      allowed_directories: dirs.map((s) => s.trim()),
      allowed_packages: pkgs.map((s) => s.trim()),
      notes: typeof rawNotes === "string" ? rawNotes : ""
    };
  } catch {
    return null;
  }
}

// src/core/derive.ts
function createEmptyQualityProgress() {
  return {
    style: "pending",
    architecture: "pending",
    performance: "pending",
    security: "pending",
    maintainability: "pending"
  };
}
function assertOrchestrator(ctx, toolName) {
  if (!ctx.orchestrator) {
    throw new Error(`工具 "${toolName}" 仅限编排者（主代理）调用，当前调用者为 "${ctx.agent}"。`);
  }
}
function findTaskGroup(state, id) {
  const item = state.workItems.find((w) => w.id === `task:${id}`);
  if (!item)
    throw new Error(`任务组 "${id}" 不在任务清单中。`);
  return taskGroupFromWorkItem(item);
}
function childPhaseToIssueStatus(phase) {
  switch (phase) {
    case "done":
      return "verified";
    case "cancelled":
      return "exempted";
    case "review":
      return "submitted";
    default:
      return "open";
  }
}
function projectIssueFromChild(child) {
  const f = resolveChildIssueFields(child);
  const baseStatus = childPhaseToIssueStatus(child.phase);
  const hasExemptRequest = child.metadata[EXEMPT_REQUEST_KEY] !== undefined;
  return {
    id: child.externalId ?? child.id.replace(/^issue:/, ""),
    dimension: f.dimension,
    sourcePhase: f.sourcePhase,
    severity: child.severity ?? "Info",
    file: f.file,
    line: f.line,
    description: child.description,
    suggestion: typeof child.metadata["suggestion"] === "string" ? child.metadata["suggestion"] : "",
    status: hasExemptRequest ? "exemption_requested" : baseStatus,
    refixCount: typeof child.metadata["refix_count"] === "number" ? child.metadata["refix_count"] : 0,
    rootCauseGuess: typeof child.metadata["root_cause_guess"] === "string" ? child.metadata["root_cause_guess"] : null,
    exemptReason: typeof child.metadata["exempt_reason"] === "string" ? child.metadata["exempt_reason"] : null,
    rejectReason: typeof child.metadata["reject_reason"] === "string" ? child.metadata["reject_reason"] : null,
    rule: typeof child.metadata["rule"] === "string" ? child.metadata["rule"] : undefined
  };
}
function workItemPhaseToTaskGroupStatus(phase) {
  switch (phase) {
    case "todo":
      return "task_analysis";
    case "in_progress":
      return "dev_impl";
    case "review":
    case "done":
      return "review";
    default:
      return "completed";
  }
}
function taskGroupFromWorkItem(item) {
  const m = item.metadata;
  const tasks = taskListOf(item);
  return {
    id: item.externalId ?? item.id.replace(/^task:/, ""),
    name: typeof m["name"] === "string" ? m["name"] : item.title,
    taskCount: typeof m["task_count"] === "number" ? m["task_count"] : tasks.length,
    worktreePath: typeof m["worktree_path"] === "string" ? m["worktree_path"] : null,
    branchName: typeof m["branch_name"] === "string" ? m["branch_name"] : null,
    baseRef: typeof m["base_ref"] === "string" ? m["base_ref"] : null,
    executionBoundary: m["execution_boundary"] ?? null,
    relevantSpecs: Array.isArray(m["relevant_specs"]) ? m["relevant_specs"] : [],
    status: workItemPhaseToTaskGroupStatus(item.phase),
    phases: {
      architect_review: { completed: false },
      review: {
        retryCount: 0,
        lastResolvedRetryCount: 0,
        tool: { completed: false },
        task: { completed: false },
        quality: { progress: createEmptyQualityProgress() }
      }
    },
    tasks,
    issues: issueChildrenOf(item).map(projectIssueFromChild),
    blockers: Array.isArray(m["blockers"]) ? m["blockers"] : [],
    agentSummaries: typeof m["agent_summaries"] === "object" ? m["agent_summaries"] : undefined
  };
}

// src/core/paths.ts
import path4 from "node:path";
function isPathWithin(base, target) {
  const rel = path4.relative(path4.resolve(base), path4.resolve(base, target));
  return rel === "" || !rel.startsWith("..") && !path4.isAbsolute(rel);
}
function assertPathWithin(base, target, subject) {
  if (!isPathWithin(base, target)) {
    throw new Error(`${subject}路径 "${target}" 超出允许目录（\`${path4.resolve(base)}\`），已拒绝。
` + `路径必须位于该目录之内，禁止用 ".." 或绝对路径逃逸到主仓库/主分支。`);
  }
  return path4.resolve(base, target);
}
function assertIssueFilesWithin(issues, base) {
  if (!base)
    return;
  for (const iss of issues) {
    if (iss.file)
      assertPathWithin(base, iss.file, "issue 文件");
  }
}

// src/core/workflow/loader.ts
import { readFileSync as readFileSync3, existsSync as existsSync4 } from "node:fs";
import { dirname as dirname2, resolve as pathResolve } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/skills/resolve.ts
import { readdirSync as readdirSync3, readFileSync as readFileSync2, existsSync as existsSync3 } from "node:fs";
import { resolve as resolve2 } from "node:path";

// src/skills/scan.ts
import { existsSync as existsSync2, readdirSync as readdirSync2 } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
var projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
function resolveSkillScanRoot(moduleUrl) {
  const startDir = dirname(fileURLToPath(moduleUrl));
  let dir = startDir;
  for (;; ) {
    for (const candidate of [resolve(dir, "assets", "skills"), resolve(dir, "skills")]) {
      if (isSkillRoot(candidate))
        return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir)
      break;
    dir = parent;
  }
  return null;
}
function isSkillRoot(candidate) {
  if (!existsSync2(candidate))
    return false;
  try {
    return readdirSync2(candidate, { withFileTypes: true }).some((entry) => entry.isDirectory() && existsSync2(join(candidate, entry.name, "SKILL.md")));
  } catch {
    return false;
  }
}
var scanRoot = resolveSkillScanRoot(import.meta.url);
var REPO_SKILL_SCAN_ROOTS = [
  ...scanRoot ? [scanRoot] : [],
  resolve(projectRoot, ".agents", "skills"),
  resolve(projectRoot, ".opencode", "skills")
];
var SKILL_SCAN_ROOTS = [
  ...REPO_SKILL_SCAN_ROOTS,
  join(homedir(), ".agents", "skills"),
  join(homedir(), ".config", "opencode", "skills")
];
var rootsOverride = null;
function effectiveSkillScanRoots() {
  return rootsOverride ?? SKILL_SCAN_ROOTS;
}
function findSkillPath(name) {
  for (const root of effectiveSkillScanRoots()) {
    const p = resolve(root, name, "SKILL.md");
    if (existsSync2(p))
      return p;
  }
  return null;
}

// src/skills/resolve.ts
var cacheKey = null;
var cacheIndex = null;
function parseFrontmatterList(raw, field) {
  const m = raw.match(new RegExp(`${field}:\\s*\\[([^\\]]*)\\]`));
  if (!m)
    return null;
  return m[1].split(",").map((s) => s.trim().replace(/["']/g, "")).filter(Boolean);
}
function scanSkillTags(roots = effectiveSkillScanRoots()) {
  const key = roots.join("\x00");
  if (cacheKey === key && cacheIndex)
    return cacheIndex;
  const tagMap = new Map;
  const skillTags = new Map;
  const skillStacks = new Map;
  const skillFrameworks = new Map;
  const seen = new Set;
  for (const root of roots) {
    if (!existsSync3(root))
      continue;
    for (const entry of readdirSync3(root, { withFileTypes: true })) {
      if (!entry.isDirectory())
        continue;
      if (seen.has(entry.name))
        continue;
      const mdPath = resolve2(root, entry.name, "SKILL.md");
      if (!existsSync3(mdPath))
        continue;
      try {
        const raw = readFileSync2(mdPath, "utf-8");
        const tags = parseFrontmatterList(raw, "capabilities");
        if (!tags)
          continue;
        skillTags.set(entry.name, tags);
        for (const tag of tags) {
          const arr = tagMap.get(tag) || [];
          arr.push(entry.name);
          tagMap.set(tag, arr);
        }
        const stacks = parseFrontmatterList(raw, "stacks");
        if (stacks && stacks.length > 0)
          skillStacks.set(entry.name, stacks);
        const frameworks = parseFrontmatterList(raw, "frameworks");
        if (frameworks && frameworks.length > 0)
          skillFrameworks.set(entry.name, frameworks);
        seen.add(entry.name);
      } catch {}
    }
  }
  cacheKey = key;
  cacheIndex = { tagMap, skillTags, skillStacks, skillFrameworks };
  return cacheIndex;
}
function resolveSkillsForCapabilities(caps, session, index) {
  if (!caps || caps.length === 0)
    return { skillNames: [] };
  const idx = index ?? scanSkillTags();
  const { tagMap, skillStacks, skillFrameworks } = idx;
  const matched = new Set;
  for (const cap of caps) {
    for (const n of tagMap.get(cap) || [])
      matched.add(n);
  }
  const skillNames = [];
  for (const name of matched) {
    const declaredStacks = skillStacks.get(name) ?? [];
    const declaredFrameworks = skillFrameworks.get(name) ?? [];
    if (session === null) {
      if (declaredStacks.length > 0 || declaredFrameworks.length > 0)
        continue;
    } else if (session && !matchesSessionStacks(declaredStacks, declaredFrameworks, session))
      continue;
    skillNames.push(name);
  }
  return { skillNames };
}

// src/skills/stacks.ts
function matchesSessionStacks(stacks, frameworks, session) {
  if (stacks.length > 0 && !stacks.some((t) => session.project_stacks.includes(t)))
    return false;
  if (frameworks.length > 0 && !frameworks.some((t) => session.project_frameworks.includes(t)))
    return false;
  return true;
}
var knownTagsOverride = null;
function knownStacks(index = scanSkillTags()) {
  if (knownTagsOverride)
    return new Set(knownTagsOverride.stacks);
  const tags = new Set;
  for (const list of index.skillStacks.values())
    for (const tag of list)
      tags.add(tag);
  return tags;
}
function knownFrameworks(index = scanSkillTags()) {
  if (knownTagsOverride)
    return new Set(knownTagsOverride.frameworks);
  const tags = new Set;
  for (const list of index.skillFrameworks.values())
    for (const tag of list)
      tags.add(tag);
  return tags;
}

// src/core/workflow/loader.ts
var SPECIAL_TRANSITIONS = ["done", "halt"];
var PHASE_NAMES = new Set(WORK_ITEM_PHASES);
var QUALITY_REVIEW_STEP_ID = "verify_quality";
var MUST_DO_ALWAYS_KEY = "always";
function resolveWorkflowFilePath(moduleUrl, fileName) {
  const startDir = dirname2(fileURLToPath2(moduleUrl));
  let dir = startDir;
  let probed = 0;
  for (;; ) {
    const candidate = pathResolve(dir, "assets", "workflows", fileName);
    if (existsSync4(candidate))
      return candidate;
    probed++;
    const parent = dirname2(dir);
    if (parent === dir)
      break;
    dir = parent;
  }
  throw new Error(`workflow 文件缺失：从 ${startDir} 上溯 ${probed} 级未找到 assets/workflows/${fileName}`);
}
function resolveTaskWorkflowPath(moduleUrl) {
  return resolveWorkflowFilePath(moduleUrl, "task.yaml");
}
function resolveMustDoCatalogPath(moduleUrl) {
  return resolveWorkflowFilePath(moduleUrl, "must-do.yaml");
}
var TASK_WORKFLOW_PATH = resolveTaskWorkflowPath(import.meta.url);
var SIMPLE_WORKFLOW_PATH = resolveWorkflowFilePath(import.meta.url, "task-simple.yaml");
var REVIEW_WORKFLOW_PATH = resolveWorkflowFilePath(import.meta.url, "review.yaml");
var REVIEW_SIMPLE_WORKFLOW_PATH = resolveWorkflowFilePath(import.meta.url, "review-simple.yaml");
var MUST_DO_CATALOG = loadMustDoCatalog(readFileSync3(resolveMustDoCatalogPath(import.meta.url), "utf-8"));
function resolveWorkflowPath(state) {
  if (state.kind === "review") {
    return state.reviewScope?.granularity === "simple" ? REVIEW_SIMPLE_WORKFLOW_PATH : REVIEW_WORKFLOW_PATH;
  }
  return state.mode === "simple" ? SIMPLE_WORKFLOW_PATH : TASK_WORKFLOW_PATH;
}
var workflowFileCache = new Map;
function loadWorkflowFile(filePath) {
  let wf = workflowFileCache.get(filePath);
  if (!wf) {
    wf = loadWorkflow(readFileSync3(filePath, "utf-8"));
    workflowFileCache.set(filePath, wf);
  }
  return wf;
}
function loadMustDoCatalog(yamlText) {
  let raw;
  try {
    raw = yaml.load(yamlText);
  } catch (err) {
    fail(`must-do 词表 YAML 解析失败：${err.message}`);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    fail("must-do 词表非法：顶层必须是 YAML 映射对象");
  }
  const items = raw.items;
  if (typeof items !== "object" || items === null || Array.isArray(items)) {
    fail("must-do 词表非法：items 必须是 id → { description, evidence } 的映射对象");
  }
  const catalog = {};
  for (const [id, value] of Object.entries(items)) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      fail(`must-do 词表非法：条目 "${id}" 必须是 { description, evidence } 对象`);
    }
    catalog[id] = {
      description: expectString(value.description, `items.${id}.description`),
      evidence: expectString(value.evidence, `items.${id}.evidence`)
    };
  }
  if (Object.keys(catalog).length === 0)
    fail("must-do 词表非法：items 不得为空（必做项词表至少一条）");
  return catalog;
}
function parseStepMustDo(raw, stepId, catalog, stacks) {
  if (raw === undefined)
    return;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    fail(`workflow 配置非法：step "${stepId}" 的 must_do 必须是分组对象（always + 可选栈分组）`);
  }
  const groups = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || v.trim() === "")) {
      fail(`workflow 配置非法：step "${stepId}" 的 must_do.${key} 必须是字符串数组（可为空数组），收到 ${JSON.stringify(value)}`);
    }
    if (key !== MUST_DO_ALWAYS_KEY && !stacks.has(key)) {
      fail(`workflow 配置非法：step "${stepId}" 的 must_do 分组键 "${key}" 不是合法项目形态栈` + `（合法值：${MUST_DO_ALWAYS_KEY} 或 skill 声明的形态标签 ${JSON.stringify([...stacks].sort())}）`);
    }
    for (const id of value) {
      if (!(id in catalog)) {
        fail(`workflow 配置非法：step "${stepId}" 的 must_do.${key} 引用了词表外必做项 "${id}"` + `（must-do.yaml 词表中不存在该 id）`);
      }
    }
    groups[key] = value;
  }
  return groups;
}
function assertMustDoCatalogReferenced(catalog, workflows) {
  const referenced = new Set;
  for (const wf of workflows) {
    for (const { step } of wf.stepMap.values()) {
      for (const ids of Object.values(step.must_do ?? {})) {
        for (const id of ids ?? [])
          referenced.add(id);
      }
    }
  }
  const orphans = Object.keys(catalog).filter((id) => !referenced.has(id));
  if (orphans.length > 0) {
    fail(`must-do 词表存在孤儿项（无任何 workflow step 引用）：${orphans.join("、")}。` + `词表与 step 声明须保持同步：删除 step 引用时同步删除词表条目，或为条目补上引用它的 step。`);
  }
}
function fail(message) {
  throw new Error(message);
}
function expectString(value, path5) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`workflow 配置非法：${path5} 必须是非空字符串，收到 ${JSON.stringify(value)}`);
  }
  return value;
}
function expectPositiveInt(value, path5) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    fail(`workflow 配置非法：${path5} 必须是正整数，收到 ${JSON.stringify(value)}`);
  }
  return value;
}
function expectStringArray(value, path5) {
  if (!Array.isArray(value) || value.length === 0 || value.some((v) => typeof v !== "string")) {
    fail(`workflow 配置非法：${path5} 必须是非空字符串数组，收到 ${JSON.stringify(value)}`);
  }
  return value;
}
function expectAgentList(value, path5) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`workflow 配置非法：${path5} 必须是非空对象数组（每个元素含 id 与 capability_tags），收到 ${JSON.stringify(value)}`);
  }
  return value.map((v, i) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      fail(`workflow 配置非法：${path5}[${i}] 必须是对象（含 id 与 capability_tags），收到 ${JSON.stringify(v)}`);
    }
    const a = v;
    return {
      id: expectString(a.id, `${path5}[${i}].id`),
      capability_tags: expectStringArray(a.capability_tags, `${path5}[${i}].capability_tags`)
    };
  });
}
function expectOptionalPositiveInt(value, path5) {
  if (value === undefined)
    return;
  return expectPositiveInt(value, path5);
}
function expectOptionalNonEmptyStringArray(value, path5) {
  if (value === undefined)
    return;
  if (!Array.isArray(value) || value.length === 0 || value.some((v) => typeof v !== "string" || v.trim() === "")) {
    fail(`workflow 配置非法：${path5} 必须是非空字符串数组，收到 ${JSON.stringify(value)}`);
  }
  return value;
}
function parseCommon(raw, workflowId) {
  if (raw === undefined)
    return;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    fail(`workflow "${workflowId}" 配置非法：common 必须是对象`);
  }
  const c = raw;
  const instructions = expectOptionalNonEmptyStringArray(c.instructions, "common.instructions");
  const constraints = expectOptionalNonEmptyStringArray(c.constraints, "common.constraints");
  if (instructions === undefined && constraints === undefined)
    return;
  return { instructions, constraints };
}
function assertQualityAgentsConsistent(workflowId, stepMap) {
  const qualityStep = stepMap.get(QUALITY_REVIEW_STEP_ID);
  if (!qualityStep)
    return;
  const declared = new Set(stepAgentIds(qualityStep.step));
  const expected = new Set(Object.values(DIMENSION_AGENT_MAP));
  if (declared.size !== expected.size || ![...expected].every((a) => declared.has(a))) {
    fail(`workflow "${workflowId}" 配置非法：${QUALITY_REVIEW_STEP_ID}.agents（${JSON.stringify([...declared])}）与质量维度 agent 映射（${JSON.stringify([...expected])}）不一致，两处须保持同一集合`);
  }
}
function parseTransitions(raw, stepId, validStepIds) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    fail(`workflow 配置非法：step "${stepId}" 的 transitions 必须是对象`);
  }
  const t = raw;
  const out = {};
  for (const key of ["on_pass", "on_fail"]) {
    const target = t[key];
    if (typeof target !== "string" || target === "") {
      fail(`workflow 配置非法：step "${stepId}" 的 transitions.${key} 必须是非空字符串`);
    }
    if (!SPECIAL_TRANSITIONS.includes(target) && !validStepIds.has(target)) {
      fail(`workflow 配置非法：step "${stepId}" 的 transitions.${key} 目标 "${target}" 不存在（既非已声明 step id，也非 done/halt 特殊值）`);
    }
    out[key] = target;
  }
  return out;
}
function loadWorkflow(yamlText, catalog = MUST_DO_CATALOG) {
  let raw;
  try {
    raw = yaml.load(yamlText);
  } catch (err) {
    fail(`workflow YAML 解析失败：${err.message}`);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    fail("workflow 配置非法：顶层必须是 YAML 映射对象");
  }
  const wf = raw;
  const id = expectString(wf.id, "id");
  const maxRetries = expectPositiveInt(wf.max_retries, "max_retries");
  const name = typeof wf.name === "string" && wf.name.trim() !== "" ? wf.name : undefined;
  if (!Array.isArray(wf.phases) || wf.phases.length === 0) {
    fail(`workflow "${id}" 配置非法：phases 必须是非空数组`);
  }
  const stackTags = knownStacks();
  const phases = [];
  const stepMap = new Map;
  const rawTransitions = new Map;
  const seenPhaseNames = new Set;
  const allStepIds = new Set;
  for (const [phaseIdx, rawPhase] of wf.phases.entries()) {
    if (typeof rawPhase !== "object" || rawPhase === null || Array.isArray(rawPhase)) {
      fail(`workflow "${id}" 配置非法：phases[${phaseIdx}] 必须是对象`);
    }
    const rp = rawPhase;
    const phaseName = expectString(rp.name, `phases[${phaseIdx}].name`);
    if (!PHASE_NAMES.has(phaseName)) {
      fail(`workflow "${id}" 配置非法：phases[${phaseIdx}].name "${phaseName}" 不是合法 phase（合法值：${WORK_ITEM_PHASES.join(", ")}）`);
    }
    if (seenPhaseNames.has(phaseName)) {
      fail(`workflow "${id}" 配置非法：phase "${phaseName}" 重复声明`);
    }
    seenPhaseNames.add(phaseName);
    const phase = { name: phaseName, steps: [] };
    if (!Array.isArray(rp.steps) || rp.steps.length === 0) {
      fail(`workflow "${id}" 配置非法：phase "${phaseName}" 的 steps 必须是非空数组`);
    }
    for (const [stepIdx, rawStep] of rp.steps.entries()) {
      if (typeof rawStep !== "object" || rawStep === null || Array.isArray(rawStep)) {
        fail(`workflow "${id}" 配置非法：phase "${phaseName}" steps[${stepIdx}] 必须是对象`);
      }
      const rs = rawStep;
      const stepId = expectString(rs.id, `phase "${phaseName}" steps[${stepIdx}].id`);
      if (allStepIds.has(stepId)) {
        fail(`workflow "${id}" 配置非法：step id "${stepId}" 重复声明`);
      }
      allStepIds.add(stepId);
      rawTransitions.set(stepId, rs.transitions);
      const agents = expectAgentList(rs.agents, `step "${stepId}" 的 agents`);
      const step = {
        id: stepId,
        agents,
        always_run: typeof rs.always_run === "boolean" ? rs.always_run : undefined,
        max_retries: expectOptionalPositiveInt(rs.max_retries, `step "${stepId}" 的 max_retries`),
        instructions: expectOptionalNonEmptyStringArray(rs.instructions, `step "${stepId}" 的 instructions`),
        constraints: expectOptionalNonEmptyStringArray(rs.constraints, `step "${stepId}" 的 constraints`),
        must_do: parseStepMustDo(rs.must_do, stepId, catalog, stackTags),
        transitions: { on_pass: "done", on_fail: "halt" }
      };
      phase.steps.push(step);
      stepMap.set(stepId, { step, phase });
    }
    phases.push(phase);
  }
  for (const { step } of stepMap.values()) {
    step.transitions = parseTransitions(rawTransitions.get(step.id), step.id, allStepIds);
  }
  assertQualityAgentsConsistent(id, stepMap);
  return {
    id,
    name,
    max_retries: maxRetries,
    phases,
    stepMap,
    common: parseCommon(wf.common, id),
    mustDoCatalog: catalog
  };
}
assertMustDoCatalogReferenced(MUST_DO_CATALOG, [
  TASK_WORKFLOW_PATH,
  SIMPLE_WORKFLOW_PATH,
  REVIEW_WORKFLOW_PATH,
  REVIEW_SIMPLE_WORKFLOW_PATH
].map((p) => loadWorkflowFile(p)));

// src/core/views.ts
import { readFileSync as readFileSync4 } from "node:fs";

// src/core/tools/gate.ts
var SKIP_REASON_ADJUDICATIONS = ["user_response", "unattended_auto", "env_unavailable"];
var SKIP_REASON_FORMAT = '{"item":"<对应必做项>","category":"<降级类别>","adjudication":"user_response|unattended_auto|env_unavailable","note":"<说明>"}';
var overrideMustDo = null;
function isValidSkipData(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data))
    return false;
  const d = data;
  if (typeof d.item !== "string" || d.item.trim().length === 0)
    return false;
  if (typeof d.category !== "string" || d.category.trim().length === 0)
    return false;
  if (typeof d.adjudication !== "string" || !SKIP_REASON_ADJUDICATIONS.includes(d.adjudication))
    return false;
  return true;
}
function parseSkipReason(reason) {
  let parsed;
  try {
    parsed = JSON.parse(reason);
  } catch {
    return {
      ok: false,
      error: `skip_reason 必须为结构化 JSON 字符串：${SKIP_REASON_FORMAT}。当前值无法解析为 JSON：${reason}`
    };
  }
  if (!isValidSkipData(parsed)) {
    return {
      ok: false,
      error: `skip_reason 结构化字段缺失或不合法：必须包含非空 item（对应必做项）、category（降级类别）、` + `adjudication（裁定方式，取值 ${SKIP_REASON_ADJUDICATIONS.join(" / ")}）。当前值：${reason}`
    };
  }
  return { ok: true, data: parsed };
}
function stepToken(name) {
  return name.trim().split(/[:：（(]/)[0].trim();
}
function resolveStepMustDo(step, session) {
  const effective = overrideMustDo ? overrideMustDo(step) : step?.must_do;
  const groups = effective;
  if (!groups)
    return [];
  const out = [];
  const seen = new Set;
  const push = (ids) => {
    for (const id of ids) {
      if (seen.has(id))
        continue;
      seen.add(id);
      out.push(id);
    }
  };
  push(groups[MUST_DO_ALWAYS_KEY] ?? []);
  for (const [key, ids] of Object.entries(groups)) {
    if (key === MUST_DO_ALWAYS_KEY)
      continue;
    if (session === null)
      continue;
    if (session && !session.project_stacks.includes(key))
      continue;
    push(ids ?? []);
  }
  return out;
}
var NO_CHANGE_TOKEN = "no_change";
function hasNoChangeDeclaration(checks) {
  return (checks ?? []).some((c) => stepToken(c.step) === NO_CHANGE_TOKEN);
}
function uncoveredMustDo(step, checks, session) {
  const must = resolveStepMustDo(step, session);
  if (must.length === 0)
    return [];
  const list = checks ?? [];
  if (hasNoChangeDeclaration(list))
    return [];
  const covered = new Set;
  for (const c of list) {
    const token = stepToken(c.step);
    if (must.includes(token))
      covered.add(token);
  }
  return must.filter((m) => !covered.has(m));
}
function mustDoChecksOfStep(metadata, stepId) {
  const raw = metadata["must_do_checks_by_step"];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return [];
  const list = raw[stepId];
  return Array.isArray(list) ? list : [];
}
function assertMustDoChecksFormat(checks) {
  for (const c of checks) {
    if (c.completed) {
      if (typeof c.evidence !== "string" || c.evidence.trim() === "") {
        throw new Error(`必做项 "${stepToken(c.step)}" 标记为已完成但未提供证据（evidence）。` + `completed=true 的申报必须附执行命令与结果摘要，未执行的项请置 completed=false 并附结构化 skip_reason。`);
      }
      continue;
    }
    if (!c.skip_reason) {
      throw new Error(`必做项 "${stepToken(c.step)}" 标记为未完成但未提供跳过原因（skip_reason）。`);
    }
    const parsed = parseSkipReason(c.skip_reason);
    if (!parsed.ok) {
      throw new Error(`必做项 "${stepToken(c.step)}" 的 skip_reason 格式不合法：${parsed.error}`);
    }
  }
}
function assertMustDoCoverage(requiredItems, checks) {
  const list = checks ?? [];
  assertMustDoChecksFormat(list);
  if (requiredItems.length === 0)
    return;
  if (hasNoChangeDeclaration(list))
    return;
  const covered = new Set;
  for (const c of list) {
    const token = stepToken(c.step);
    if (requiredItems.includes(token))
      covered.add(token);
  }
  const missing = requiredItems.filter((m) => !covered.has(m));
  if (missing.length === 0)
    return;
  throw new Error(`提交的必做项申报未覆盖本 step 的必做清单，缺少以下必做项：${missing.join("、")}。
` + `请按本 step 必做清单逐项执行并逐项申报结果（completed=true + evidence）；` + `确实无法执行的必做项须以 completed=false + 结构化 skip_reason 申报降级理由` + `（格式：${SKIP_REASON_FORMAT}）。` + `低成本必做项必须实跑后申报；核验申报仅限 workflow 指令白名单限定的高成本必做项。`);
}

// src/core/views.ts
function renderSkillSuggestions(agent, caps, session) {
  if (caps.length === 0)
    return [];
  const index = scanSkillTags();
  const { skillNames } = resolveSkillsForCapabilities(caps, session, index);
  const lines = [];
  if (skillNames.length === 0)
    return lines;
  lines.push("## Skill 加载清单", "");
  lines.push("必须加载（逐项用 Skill tool 加载，未找到时跳过）：", "");
  for (const name of skillNames) {
    lines.push(`- \`${name}\``);
  }
  lines.push("");
  lines.push("（其他 available_skills 中未列举的相关 skill，按需加载）");
  lines.push("");
  const hinted = [];
  for (const name of skillNames) {
    const mdPath = findSkillPath(name);
    if (!mdPath)
      continue;
    try {
      const raw = readFileSync4(mdPath, "utf-8");
      if (!raw.includes("boundary_hints:"))
        continue;
      const dm = raw.match(/directories:\s*\[([^\]]*)\]/);
      if (dm)
        for (const d of dm[1].split(",").map((s) => s.trim().replace(/["']/g, ""))) {
          hinted.push(`- \`${name}\` → \`${d}\``);
        }
    } catch {}
  }
  if (hinted.length > 0) {
    lines.push("## 路径提示（skill 声明的 boundary_hints）", "");
    lines.push("以下目录不受执行边界限制：", "");
    lines.push(...hinted);
    lines.push("");
  }
  return lines;
}
function isWorktreeReady(tg) {
  return Boolean(tg.worktreePath);
}
function renderWorktreeNotReady() {
  return ["- (worktree 未就绪 — 请编排者先调用 opx_orch_set_worktree)"];
}
function renderStateMismatchDiagnostic(phase, currentStep, expectedPhase) {
  return [
    `- **当前阶段 (phase)**: \`${phase}\``,
    `- **当前 step**: \`${currentStep ?? "(无)"}\``,
    `- **step 预期归属阶段**: \`${expectedPhase ?? "(未知)"}\``
  ];
}
function renderWorktreeSection(state, tg, opts) {
  const lines = [];
  lines.push("## Worktree", "");
  if (state.kind !== "review") {
    lines.push(`- **基准分支**: \`${state.baseBranch}\``);
  }
  if (tg.worktreePath) {
    lines.push(`- **路径**: \`${tg.worktreePath}\``);
    lines.push(`- **分支**: \`${tg.branchName || "(none)"}\``);
    if (state.kind === "review") {
      if (state.reviewScope?.scopeType === "pr" && tg.baseRef) {
        lines.push(`- **审查范围**: PR 区间审查（${state.reviewScope.baseRef}..${state.reviewScope.headRef}）——` + `用 \`git -C ${tg.worktreePath} diff --name-only ${tg.baseRef}..HEAD\` 查询本区间已提交变更文件`);
      } else {
        lines.push("- **审查范围**: 全量代码库审查（无区间界定，工具检查与审查覆盖整个代码库）");
      }
    } else if (tg.baseRef) {
      lines.push(`- **变更范围**: 用 \`git -C ${tg.worktreePath} diff --name-only ${tg.baseRef}..HEAD\` 查询本任务组的已提交变更文件`);
    }
    lines.push("- **⚠️ 约束**: 所有读写和 git 操作均在此目录下进行；严禁直接修改主仓库/主分支路径下的文件（如 `<repo>/openspec/...`）");
    lines.push("- **路径解析**: 推荐阅读文档均为相对 worktree 路径的引用，一律以 worktree 路径为基准解析，禁止从主仓库根目录解析");
  } else {
    lines.push(...renderWorktreeNotReady());
  }
  if (opts?.showNamespace) {
    lines.push(`- **隔离标识**: \`${state.isolationNamespace}\``);
    if (opts?.showPort) {
      lines.push(`  - 建议端口: ${derivePortFromNamespace(state.isolationNamespace)}`);
    }
  }
  lines.push("");
  return lines;
}
function formatFilePath(file, line, maxLen = 60) {
  const suffix = line > 0 ? `:${line}` : "";
  const full = `${file}${suffix}`;
  if (full.length <= maxLen)
    return full;
  const parts = file.split("/");
  if (parts.length <= 1)
    return full.slice(0, maxLen - 3) + "...";
  const base = parts[parts.length - 1];
  const parent = parts[parts.length - 2];
  const tryTwo = `.../${parent}/${base}${suffix}`;
  if (tryTwo.length <= maxLen)
    return tryTwo;
  const lastSeg = `${base}${suffix}`;
  if (lastSeg.length <= maxLen)
    return lastSeg;
  return lastSeg.slice(0, maxLen - 3) + "...";
}
function renderTaskItem(t) {
  const trace = t.specTrace ? ` [spec:${t.specTrace}]` : "";
  return `- Task id=${t.id} ｜ ${t.title}${trace}`;
}
function formatSeverity(severity) {
  switch (severity) {
    case "Critical":
      return `**${severity}**`;
    case "High":
      return `**${severity}**`;
    case "Medium":
      return `*${severity}*`;
    case "Low":
      return severity;
    case "Info":
      return `\`${severity}\``;
    default:
      return severity;
  }
}
function renderAgentSummaries(agentSummaries, agentName) {
  if (!agentSummaries || !agentSummaries[agentName])
    return [];
  const lines = ["## 上轮会话摘要", ""];
  lines.push(`- **${agentName}**：${agentSummaries[agentName]}`);
  lines.push("");
  return lines;
}
function renderDevMustDoDeclaration(metadata) {
  const checks = mustDoChecksOfStep(metadata, "implement");
  if (checks.length === 0)
    return [];
  const lines = ["## 开发者必做项申报（implement）", ""];
  for (const c of checks) {
    const token = stepToken(c.step);
    if (c.completed) {
      const evidence = typeof c.evidence === "string" && c.evidence.trim() !== "" ? c.evidence.trim() : "(未附证据)";
      lines.push(`- **${token}**：已完成 — ${evidence}`);
    } else {
      lines.push(`- **${token}**：未完成 — 降级理由：${c.skip_reason ?? "(未申报)"}`);
    }
  }
  lines.push("");
  return lines;
}
function extractDeploymentNoteLines(metadata) {
  const raw = metadata["deployment_notes"];
  if (!Array.isArray(raw))
    return [];
  const out = [];
  for (const item of raw) {
    if (typeof item !== "string")
      continue;
    const trimmed = item.trim();
    if (trimmed !== "")
      out.push(trimmed);
  }
  return out;
}
var INTERPOLATION_ALLOWED_KEYS = new Set([
  "worktree_path",
  "change_id",
  "step_id",
  "phase",
  "agent",
  "allowed_directories",
  "allowed_packages",
  "notes",
  "base_branch"
]);
function interpolateText(text, ctx) {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (raw, key) => {
    if (!INTERPOLATION_ALLOWED_KEYS.has(key))
      return raw;
    const value = ctx[key];
    return value === undefined ? raw : value;
  });
}

// src/core/workflow/status.ts
function renderWorkflowStatusView(item, workflow, rec, caller, options) {
  const body = renderWorkflowStatusViewCore(item, workflow, rec, caller, options);
  if (options.state.stacks)
    return body;
  return [
    "> **旧会话未固化项目栈**：当前只加载通用 skill，技术栈配套 skill 与其必做项不参与。",
    "> 补齐方式：调用 `opx_orch_init` 并携带 `project_stacks` / `project_frameworks`（可用 `recovery` 恢复当前进度）。",
    "",
    body
  ].join(`
`);
}
function renderWorkflowStatusViewCore(item, workflow, rec, caller, options) {
  const ctxAgent = caller.agent;
  if (phaseStepMismatch(item, workflow)) {
    if (!caller.orchestrator) {
      return renderStateMismatch(item, workflow);
    }
  }
  if (item.metadata["_checkpoint"] === true || rec.status === "checkpoint") {
    return renderCheckpoint(rec, workflow, item, options.state);
  }
  if (rec.status === "suspended") {
    return renderSuspended(item);
  }
  if (item.phase === "done" || item.phase === "cancelled") {
    return renderTerminalPhase(item, options.state, caller);
  }
  if (rec.status === "blocked") {
    if (caller.orchestrator) {
      return renderOrchestratorDispatch(options.state, item, workflow, rec, options.tg, options.mainPollution, caller.identityDeclared);
    }
    return renderBlocked(rec, item, workflow, ctxAgent);
  }
  if (rec.status === "terminal") {
    if (caller.orchestrator) {
      return renderOrchestratorDispatch(options.state, item, workflow, rec, options.tg, options.mainPollution, caller.identityDeclared);
    }
    return renderTerminal(rec);
  }
  if (caller.orchestrator) {
    return renderOrchestratorDispatch(options.state, item, workflow, rec, options.tg, options.mainPollution, caller.identityDeclared);
  }
  if (rec.agents.includes(ctxAgent)) {
    const step = rec.stepId ? workflow.stepMap.get(rec.stepId)?.step ?? null : null;
    return renderAgentWorking(item, rec, step, workflow.common, ctxAgent, options.state, options.tg, workflow.mustDoCatalog, options.toolChanges, options.exemptedHits, exemptionHintCtx(options.exemptionItems));
  }
  return renderGate(rec, item, ctxAgent);
}
function buildRuleFileLineMap(items) {
  const m = new Map;
  for (const it of items) {
    if (typeof it.rule === "string" && it.rule !== "" && typeof it.file === "string" && it.file !== "") {
      m.set([it.rule, it.file].join("\x00"), it.line ?? 0);
    }
  }
  return m;
}
function exemptionHintCtx(items) {
  if (!items || items.length === 0)
    return;
  return { items, ruleFileLines: buildRuleFileLineMap(items) };
}
function renderCheckpoint(rec, workflow, item, state) {
  const round = rec.checkpoint?.retryCount ?? "?";
  const step = rec.stepId ?? "(无)";
  const lines = [
    `# ⛔ 审查重试达到检查点（第 ${round} 轮）`,
    "",
    "需要用户决策。",
    `唯一动作：调用 \`opx_agent_submit({ step_id: "${step}", checkpoint_decision: "continue" })\`（continue / giveup 二选一）推进。`,
    ""
  ];
  const entry = rec.stepId ? workflow.stepMap.get(rec.stepId) : undefined;
  const mustDoItems = resolveStepMustDo(entry?.step, state?.stacks ?? null);
  if (mustDoItems.length > 0) {
    lines.push("## 当前 step 的必做清单", "");
    for (const id of mustDoItems) {
      const desc = workflow.mustDoCatalog[id]?.description;
      lines.push(`- \`${id}\`${desc ? `：${desc}` : ""}`);
    }
    lines.push("");
    lines.push("## giveup 申报要求", "");
    lines.push(`未覆盖的必做项须经 \`checkpoint_skip_reasons\` 逐项申报结构化降级理由（格式：\`${SKIP_REASON_FORMAT}\`），` + `缺理由 giveup 不会被受理；已按 step 存档申报的项不需重复提供。`, "");
  }
  return lines.join(`
`);
}
function renderSuspended(item) {
  const reason = item.metadata["suspend_reason"] || "suspended";
  return [
    "# ⏸ WorkItem 已暂停",
    "",
    `- **原因**: ${reason}`,
    `- **当前 step**: \`${item.currentStep ?? "(无)"}\``,
    "",
    "暂停期间跳过调度，请结束当前会话，不执行任何操作。",
    ""
  ].join(`
`);
}
function renderTerminalPhase(item, state, caller) {
  if (item.phase === "cancelled") {
    return [
      "# \uD83D\uDEAB 任务组已取消",
      "",
      "- **说明**: 该 WorkItem 已取消，编排停止，请结束当前会话。",
      ""
    ].join(`
`);
  }
  if (state?.kind === "review") {
    if (item.metadata["completed_at"] !== undefined) {
      return [
        "# ✅ 独立审查会话已完成",
        "",
        `- **完成时间**: ${item.metadata["completed_at"]}`,
        "",
        "审查结果摘要见收尾返回体（opx_orch_complete_task_group）。",
        ""
      ].join(`
`);
    }
    const lines = [
      "# \uD83C\uDFC1 独立审查已完成，待收尾",
      "",
      renderReviewReport(item),
      "",
      "全部审查层已收口。调用 `opx_orch_complete_task_group` 完成收尾（只审模式销毁 worktree 不合并，审并修模式合并回目标分支）。",
      ""
    ];
    return lines.join(`
`);
  }
  const finalGroup = state ? isFinalTaskGroup(state, item) : true;
  if (item.metadata["completed_at"] !== undefined) {
    return [
      "# ✅ 任务组已完成",
      "",
      `- **完成时间**: ${item.metadata["completed_at"]}`,
      "",
      finalGroup ? "本任务组为最后一个收口任务组，change 收口已完成：变更分支已合并回基准分支，编排已完成并收尾。" : `本任务组已完成，变更保留在 change 分支上，待全部任务组完成后统一收口合并。${cancelTaskGroupNote(state)}`,
      "",
      ...renderDeploymentNotesSection(state, item, caller)
    ].join(`
`);
  }
  return [
    "# \uD83C\uDFC1 任务组已完成，待收尾",
    "",
    "全部审核层已通过。",
    finalGroup ? "调用 `opx_orch_complete_task_group` 完成 change 收口（把变更分支合并回基准分支并清理）。" : "调用 `opx_orch_complete_task_group` 完成任务组收尾（变更保留在 change 分支，统一收口时合并）。",
    "",
    ...renderDeploymentNotesSection(state, item, caller)
  ].join(`
`);
}
function cancelTaskGroupNote(state) {
  if (!state)
    return "";
  return `若某任务组已确认不再执行，当前版本不支持取消任务组，须人工编辑编排 state 文件（openspec/states/${state.changeId}.json）将该任务组的 phase 改为 "cancelled"，收口合并才会触发。`;
}
function renderDeploymentNotesSection(state, item, caller) {
  if (!caller?.orchestrator || !state || state.kind === "review")
    return [];
  if (!isFinalTaskGroup(state, item))
    return [];
  const taskGroups = state.workItems.filter((w) => w.id.startsWith("task:"));
  const lines = [
    "## 部署注意事项汇报",
    "",
    "向用户汇报本次变更的部署注意事项：",
    "",
    `- 阅读主仓库 \`openspec/changes/${state.changeId}/\` 下规划文档（design.md、tasks.md、proposal.md、specs/）提取部署要点：数据/结构变更脚本执行、消息队列/缓存等中间件配置调整、新增配置项或功能开关、外部接口契约变化、依赖清单/构建配置变更（合并后需在主仓库重装依赖、重新构建）。该目录在收口时会被 openspec archive 归档，归档后文档位于 \`openspec/changes/archive/\` 下`,
    "- 无规划文档时跳过文档提取，仅转述下方实施补充点",
    ""
  ];
  const supplementary = taskGroups.flatMap((g) => {
    const notes = extractDeploymentNoteLines(g.metadata);
    if (notes.length === 0)
      return [];
    const tg = taskGroupFromWorkItem(g);
    return [`- ${tg.name}(${tg.id}):`, ...notes.map((n) => `  - ${n}`)];
  });
  if (supplementary.length > 0) {
    lines.push("实施补充点（开发者实施时申报，原样转述）：", "");
    lines.push(...supplementary);
    lines.push("");
  }
  return lines;
}
function renderReviewReport(item) {
  const issues = issueChildrenOf(item);
  if (issues.length === 0)
    return "未报出任何 issue。";
  const bySeverity = new Map;
  const byDimension = new Map;
  for (const c of issues) {
    const sev = c.severity ?? "Info";
    const f = resolveChildIssueFields(c);
    bySeverity.set(sev, (bySeverity.get(sev) ?? 0) + 1);
    byDimension.set(f.dimension, (byDimension.get(f.dimension) ?? 0) + 1);
  }
  const lines = [
    "## 审查结果报告",
    "",
    `- **issue 总数**: ${issues.length}`,
    `- **按严重级别**: ${[...bySeverity.entries()].map(([k, v]) => `${k}=${v}`).join("、")}`,
    `- **按维度**: ${[...byDimension.entries()].map(([k, v]) => `${k}=${v}`).join("、")}`,
    ""
  ];
  for (const sev of ["Critical", "High", "Medium", "Low", "Info"]) {
    const group = issues.filter((c) => (c.severity ?? "Info") === sev);
    if (group.length === 0)
      continue;
    lines.push(`### ${sev}（${group.length} 个）`, "");
    for (const c of group) {
      const id = c.externalId ?? c.id.replace(/^issue:/, "");
      const f = resolveChildIssueFields(c);
      lines.push(`- Issue #${id} | 维度:${f.dimension}${f.file ? ` | \`${formatFilePath(f.file, f.line)}\`` : ""}`);
      lines.push(`  - 描述：${c.description}`);
      if (typeof c.metadata["suggestion"] === "string")
        lines.push(`  - 建议：${c.metadata["suggestion"]}`);
    }
    lines.push("");
  }
  return lines.join(`
`);
}
function renderBlocked(rec, item, workflow, ctxAgent) {
  const step = rec.stepId ? workflow.stepMap.get(rec.stepId)?.step ?? null : null;
  const isCurrentAgent = step ? stepAgentIds(step).includes(ctxAgent) : false;
  const reason = rec.blockedReason ?? "(未知)";
  if (isCurrentAgent) {
    const layer = step ? REVIEW_STEP_TO_LAYER[step.id] : undefined;
    const children = issueChildrenOf(item);
    const pendingRecheck = layer ? children.filter((c) => isAgentOwnedIssue(c, ctxAgent) && isBlockingSeverity(c.severity)) : [];
    const pendingExempt = layer ? children.filter((c) => isAdjudicableExempt(c, layer, ctxAgent) && isBlockingSeverity(c.severity)) : [];
    const lines = [
      "# ⛔ 当前 step 阻塞中，等待编排处理",
      "",
      `- **原因**: ${reason}`,
      ""
    ];
    if (pendingRecheck.length > 0 && step) {
      lines.push(...renderBlockedAdjudicationBlock("本层待复核 issue", pendingRecheck, `调用 \`opx_agent_submit({ step_id: "${step.id}", verdict: "passed", recheck_adjudications: [{ issue_id: "<上述 issue id>", verdict: "passed" }] })\` 补带复核结论重提；` + `复核通过后自动推进。复核不通过则传 verdict=rejected 并附 reject_reason 驳回（issue 回待修复并累计修复未过次数）。`));
    }
    if (pendingExempt.length > 0 && step) {
      lines.push(...renderBlockedAdjudicationBlock("本层待裁定豁免申请", pendingExempt, `调用 \`opx_agent_submit({ step_id: "${step.id}", verdict: "passed", exempt_adjudications: [{ issue_id: "<上述 issue id>", action: "dismissed" }] })\` 补交豁免裁定解除阻塞；` + `裁定 dismissed（认可豁免）时 verdict 配 passed，裁定 rejected（驳回=需修复）时 verdict 必须配 failed（审查不能判定通过）。`));
    }
    if (pendingRecheck.length === 0 && pendingExempt.length === 0) {
      lines.push("你属于当前轮次角色，请勿自行推进，等待编排者解除阻塞后重新查询状态。");
    }
    lines.push("");
    return lines.join(`
`);
  }
  return [
    "# ⛔ 当前无法推进（blocked）",
    "",
    `- **原因**: ${reason}`,
    ""
  ].join(`
`);
}
function renderBlockedAdjudicationBlock(title, children, guidance) {
  const lines = [`- **${title}（${children.length} 个）**:`];
  for (const c of children) {
    const id = c.externalId ?? c.id.replace(/^issue:/, "");
    lines.push(`  - Issue #${id} | ${formatSeverity(c.severity ?? "Info")}`);
  }
  lines.push("", `**自助恢复**：${guidance}`, "");
  return lines;
}
function renderTerminal(rec) {
  return [
    "# \uD83C\uDFC1 当前 step 已通过",
    "",
    `- **说明**: ${rec.message ?? "step 已通过，沿 transitions.on_pass 推进（由 submit 工具执行状态迁移）。"}`,
    ""
  ].join(`
`);
}
function renderOrchestratorDispatch(state, item, workflow, rec, tg, mainPollution, identityDeclared) {
  const lines = [
    "# 编排进度",
    "",
    `**变更**: ${state.changeId}`,
    `**当前阶段**: ${item.phase}（step \`${rec.stepId ?? "(无)"}\`）`,
    ""
  ];
  if (phaseStepMismatch(item, workflow)) {
    const entry = item.currentStep ? workflow.stepMap.get(item.currentStep) : undefined;
    lines.push("## ⚠️ 状态异常（phase ↔ step 归属不一致）", "");
    lines.push(...renderStateMismatchDiagnostic(item.phase, item.currentStep, entry?.phase.name ?? null));
    lines.push("");
    lines.push("WorkItem 阶段与当前 step 归属错位，禁止分派任何子代理执行；请调用 `opx_orch_init(recovery=...)` 重置异常状态后重新调度。");
    lines.push("");
  }
  const metaReason = item.metadata["_advance_block_reason"];
  const advanceBlockReason = typeof metaReason === "string" && metaReason !== "" ? metaReason : rec.blockedReason;
  if (advanceBlockReason) {
    lines.push(`**推进阻塞**: ${advanceBlockReason}`);
    lines.push("");
  }
  lines.push(...renderProgressSection(item, workflow));
  lines.push(...renderOrchestratorBlockers(item));
  if (mainPollution && mainPollution.files.length > 0) {
    lines.push("## ⚠️ 主仓库 openspec 污染", "");
    lines.push(`检测到主仓库 \`${mainPollution.repoRoot}\` 下 openspec 文档存在未提交变更（修改/新增）：`);
    lines.push("");
    for (const f of mainPollution.files)
      lines.push(`- \`${f}\``);
    lines.push("");
    lines.push("子代理文件操作应限定在 worktree 内，主仓库路径出现变更通常由误改主分支路径造成，请人工核对处理。");
    lines.push("");
  }
  lines.push(...renderWorktreeSection(state, tg));
  lines.push("## 下一步", "");
  const agents = rec.agents;
  if (agents.length > 0) {
    if (!isWorktreeReady(tg)) {
      lines.push("分派前置条件未满足：当前存在待分派子代理，但 worktree 未就绪，暂不给出分派指令。");
      lines.push("请先调用 `opx_orch_set_worktree` 确保 worktree 就绪，再回来查 `opx_status` 获取分派指令。");
    } else {
      const agentList = agents.map((a) => `\`${a}\``).join("、");
      lines.push(`分派子代理：${agentList}。`);
      if (agents.length > 1) {
        lines.push("（多子代理相互独立，可在单条消息中并排分派，无需串行等待）");
      }
    }
  } else {
    const failed = failedAgentsOnStep(item, workflow, rec.stepId);
    if (failed.length > 0) {
      lines.push("⚠️ 状态不一致：存在 failed 裁决残留但无待分派项，下一步无法正常推进。");
      lines.push(`  - 失败维度：${failed.map((a) => `\`${a}\``).join("、")}`);
      lines.push("  建议：调用 `opx_orch_init(recovery=...)` 重置对应层审查进度后重新验证，勿盲目回退 dev。");
    } else if (rec.status === "blocked") {
      const diag = renderBlockedChildrenDiagnostic(item, workflow, rec.stepId);
      if (diag.length > 0)
        lines.push(...diag);
      else
        lines.push("（无待分派项，请检查状态）");
    } else {
      lines.push("（无待分派项，请检查状态）");
    }
  }
  lines.push("");
  if (identityDeclared === false) {
    const agentGuidance = workflow.common?.instructions?.find((i) => i.includes("_agent"));
    if (agentGuidance) {
      lines.push(`> **身份提示**：${interpolateText(agentGuidance, {})}`, "");
    }
  }
  return lines.join(`
`);
}
function failedAgentsOnStep(item, workflow, stepId) {
  if (!stepId)
    return [];
  const step = workflow.stepMap.get(stepId)?.step;
  if (!step)
    return [];
  return step.agents.filter((a) => getStepVerdict(item, stepId, a.id) === "failed").map((a) => a.id);
}
function renderBlockedChildrenDiagnostic(item, workflow, stepId) {
  if (!stepId)
    return [];
  const step = workflow.stepMap.get(stepId)?.step;
  if (!step)
    return [];
  const children = blockingStepChildren(item, step);
  if (children.length === 0)
    return [];
  const lines = [
    "⚠️ 当前 step 已全 passed 但存在阻塞 children，且无可补交裁定的 reviewer：",
    ""
  ];
  for (const c of children) {
    const id = c.externalId ?? c.id.replace(/^issue:/, "");
    const f = resolveChildIssueFields(c);
    const source = readIssueSource(c) ?? "(报源缺失)";
    const state = c.metadata[EXEMPT_REQUEST_KEY] !== undefined ? "豁免申请中" : c.phase === "review" ? "待复核" : `待处理(${c.phase})`;
    lines.push(`- Issue #${id} | ${formatSeverity(c.severity ?? "Info")} | 归属:${f.dimension} | 报源:${source} | ${state}`);
  }
  lines.push("");
  lines.push("处理建议：待复核/豁免申请中条目需报源 reviewer 补交裁定（recheck_adjudications / exempt_adjudications）；");
  lines.push("待处理条目需 developer 修复；报源缺失时核对 state 文件后按需 `opx_orch_init(recovery=...)` 恢复。");
  lines.push("");
  return lines;
}
function renderProgressSection(item, workflow) {
  const lines = ["## 阶段进展 / 审核进度", ""];
  lines.push("| step | agent | verdict |");
  lines.push("|------|-------|---------|");
  for (const phase of workflow.phases) {
    if (isTerminalPhase(phase.name))
      continue;
    for (const step of phase.steps) {
      const stepLabel = step.id === "analyze" ? `\`${step.id}\`（提案期已替代；仅 blocker 回退时执行）` : `\`${step.id}\``;
      for (const agent of stepAgentIds(step)) {
        lines.push(`| ${stepLabel} | \`${agent}\` | ${getStepVerdict(item, step.id, agent)} |`);
      }
    }
  }
  lines.push("");
  const counts = childStatusCounts(item);
  lines.push("**children 统计**：", "");
  lines.push(`- 待处理 ${counts.todo} · 待复核 ${counts.review} · 已验证 ${counts.done} · 已豁免 ${counts.cancelled}`);
  if (counts.exempt > 0)
    lines.push(`- 豁免申请中 ${counts.exempt}`);
  lines.push("");
  return lines;
}
function childStatusCounts(item) {
  const counts = { todo: 0, review: 0, done: 0, cancelled: 0, exempt: 0 };
  for (const c of issueChildrenOf(item)) {
    const isExemptRequest = c.metadata[EXEMPT_REQUEST_KEY] !== undefined;
    if (isExemptRequest)
      counts.exempt++;
    switch (c.phase) {
      case "todo":
        if (!isExemptRequest)
          counts.todo++;
        break;
      case "review":
        if (!isExemptRequest)
          counts.review++;
        break;
      case "done":
        counts.done++;
        break;
      case "cancelled":
        counts.cancelled++;
        break;
    }
  }
  return counts;
}
function renderOrchestratorBlockers(item) {
  const blockers = readBlockers(item);
  if (blockers.length === 0)
    return [];
  const lines = ["## Blocker", ""];
  for (const b of blockers) {
    const status = b.status === "resolved" ? "✓ 已解决" : "⏳ 待处理";
    lines.push(`- Blocker #${b.id} | ${status} | ${b.category}`);
    lines.push(`  - 来源：${b.sourceRole}${b.taskId ? `；Task #${b.taskId}` : ""}`);
    lines.push(`  - 描述：${b.description}`);
    if (b.userResponse)
      lines.push(`  - 用户答复：${b.userResponse}`);
  }
  lines.push("");
  return lines;
}
function renderGate(rec, item, ctxAgent) {
  const expected = rec.agents.join(", ") || "(无)";
  return [
    "# ⛔ 阶段门禁",
    "",
    `当前阶段为 **${item.phase}**（step \`${rec.stepId ?? "(无)"}\`），未轮到你（**${ctxAgent}**）执行。`,
    `当前预期角色为：\`${expected}\``,
    "",
    "请立即结束当前会话，不要执行任何操作。",
    ""
  ].join(`
`);
}
function renderStateMismatch(item, workflow) {
  const entry = item.currentStep ? workflow.stepMap.get(item.currentStep) : undefined;
  return [
    "# ⛔ 状态异常，当前拒绝执行",
    "",
    "WorkItem 阶段与当前 step 归属不一致（phase ↔ step 错位），状态异常：",
    ...renderStateMismatchDiagnostic(item.phase, item.currentStep, entry?.phase.name ?? null),
    "",
    "请立即结束当前会话，不执行任何操作、不调用任何 `opx_*` 变更工具。",
    "请报告编排者调用 `opx_orch_init(recovery=...)` 重置异常状态后重新调度。",
    ""
  ].join(`
`);
}
function renderAgentWorking(item, rec, step, common2, ctxAgent, state, tg, mustDoCatalog, toolChanges, exemptedHits, exemptionCtx) {
  if (!isWorktreeReady(tg)) {
    return [
      "# ⛔ worktree 未就绪，当前拒绝执行",
      "",
      ...renderWorktreeNotReady(),
      "",
      "请立即结束当前会话，不执行任何操作、不调用 `opx_agent_submit`。",
      "报告编排者先调用 `opx_orch_set_worktree`，就绪后再回来执行。",
      ""
    ].join(`
`);
  }
  if (step?.id === "verify_tool" && agentToReviewLayer(ctxAgent) === "tool" && toolChanges && !toolChanges.scopeFull) {
    const { active, pending } = toolPendingChildren(item, ctxAgent);
    if (!toolChanges.hasNonDocChange && active.length === 0 && pending.length === 0) {
      return renderToolDirectSubmit(exemptedHits);
    }
    if (!toolChanges.hasNonDocChange) {
      return renderToolAdjudicateOnly(item, rec, ctxAgent, exemptedHits, exemptionCtx);
    }
  }
  const caps = step?.agents.find((a) => a.id === ctxAgent)?.capability_tags ?? [];
  const stepCtx = {};
  if (tg.worktreePath)
    stepCtx["worktree_path"] = tg.worktreePath;
  stepCtx["change_id"] = state.changeId;
  if (rec.stepId)
    stepCtx["step_id"] = rec.stepId;
  stepCtx["phase"] = item.phase;
  stepCtx["agent"] = ctxAgent;
  stepCtx["base_branch"] = state.baseBranch;
  const boundary = readExecutionBoundary(item);
  const boundaryDirs = boundary?.allowed_directories ?? [];
  const boundaryPkgs = boundary?.allowed_packages ?? [];
  stepCtx["allowed_directories"] = boundaryDirs.length > 0 ? boundaryDirs.join(", ") : boundary ? "整个 worktree（执行边界未限定目录）" : "整个 worktree（未从 clarify.md 解析到执行边界）";
  stepCtx["allowed_packages"] = boundaryPkgs.length > 0 ? boundaryPkgs.join(", ") : boundary ? "不适用（执行边界未限定包）" : "不适用（未产出执行边界）";
  stepCtx["notes"] = boundary?.notes?.trim() ? boundary.notes : "无额外说明";
  const lines = [
    "# ✅ 当前轮到你执行",
    "",
    "完成本职工作后**必须**调用 `opx_agent_submit()` 提交。",
    "按结果提交 `verdict=passed` 或 `verdict=failed`。",
    "",
    "---",
    "",
    "# 当前任务上下文",
    "",
    `**变更**: ${state.changeId}`,
    `**阶段**: ${item.phase} | **step**: \`${rec.stepId ?? "(无)"}\``,
    ""
  ];
  if ((exemptedHits ?? 0) > 0) {
    lines.push(`> **存量豁免提示**：本 change 存在 ${exemptedHits} 个命中项目级跨 change 豁免清单的存量问题（已按 Info 处理，不阻塞、无需重复豁免）。`, "");
  }
  lines.push(...renderStepSemantics(step, common2, stepCtx));
  const mustDoItems = resolveStepMustDo(step ?? undefined, state.stacks ?? null);
  lines.push(...renderMustDoChecklist(mustDoItems, mustDoCatalog, rec.stepId));
  lines.push(...renderWorktreeSection(state, tg, { showNamespace: true, showPort: true }));
  if (step?.id === "verify_tool" && agentToReviewLayer(ctxAgent) === "tool" && toolChanges?.hasNonDocChange) {
    lines.push(...renderToolChangesEvidence(item, tg, toolChanges, "tool_review"));
  }
  if (step?.id === "quality_review" && toolChanges) {
    lines.push(...renderToolChangesEvidence(item, tg, toolChanges, "merged_review"));
  }
  if (step?.id === "quality_review" && state.kind !== "review") {
    lines.push(...renderDevMustDoDeclaration(item.metadata));
  }
  lines.push(...renderAgentSummaries(readAgentSummaries(item), ctxAgent));
  lines.push(...renderStepContext(item, step, ctxAgent, state, exemptionCtx));
  lines.push(...renderSkillSuggestions(ctxAgent, caps, state.stacks ?? null));
  lines.push("## 操作指引", "");
  let n = 0;
  lines.push(`${n++}. 按上方「Skill 加载清单」逐项加载列出的 skill（不可跳步）`);
  if (tg.worktreePath && tg.baseRef) {
    lines.push(`${n++}. 用上方「变更范围」命令获取本任务组的已提交变更文件清单，作为本次实施/修改范围；审查/报告范围以当前 step 指令为准`);
  }
  lines.push(`${n++}. 执行当前 step（\`${rec.stepId}\`）职责范围内的全部工作——遵循所有已加载 skill 的全部规范与约束`);
  lines.push(`${n++}. 逐项检视所有已加载 skill 的 MUST 规范，确认全部满足（不满足则补做，不得跳过）`);
  for (const instruction of common2?.instructions ?? []) {
    lines.push(`${n++}. ${interpolateText(instruction, stepCtx)}`);
  }
  for (const instruction of step?.instructions ?? []) {
    lines.push(`${n++}. ${interpolateText(instruction, stepCtx)}`);
  }
  if (mustDoItems.length > 0) {
    lines.push(`${n++}. 提交前逐项申报「本 step 必做清单」处理结果（\`must_do_checks\`）：completed=true 须附证据，无法执行的项置 completed=false + 结构化 skip_reason`);
  }
  lines.push(`${n++}. 全部完成 → commit → \`opx_agent_submit({ step_id: "${rec.stepId}", verdict: "passed" })\``);
  lines.push(`${n++}. 遇阻塞无法继续 → \`opx_agent_submit({ step_id: "${rec.stepId}", verdict: "failed" })\``);
  lines.push("");
  return lines.join(`
`);
}
function renderMustDoChecklist(items, catalog, stepId) {
  if (items.length === 0)
    return [];
  const lines = ["## 本 step 必做清单", ""];
  lines.push("本 step 的必做项由 workflow 声明、按会话项目形态栈过滤；提交时必须逐项申报处理结果。", "");
  for (const id of items) {
    const meta = catalog[id];
    const desc = meta?.description ?? "(词表缺失该条目)";
    lines.push(`- \`${id}\`：${desc}`);
    if (meta?.evidence)
      lines.push(`  - 证据要求：${meta.evidence}`);
  }
  lines.push("");
  lines.push("**提交申报示例**（`must_do_checks`，逐项对齐上方清单）：", "");
  lines.push("```json");
  lines.push('"must_do_checks": [');
  const sample = items.slice(0, 2);
  sample.forEach((id, i) => {
    const sep = i === sample.length - 1 && items.length <= sample.length ? "" : ",";
    lines.push(`  { "step": "${id}", "completed": true, "evidence": "<执行命令 + 结果摘要>" }${sep}`);
  });
  if (items.length > sample.length)
    lines.push("  …（其余必做项同上逐项申报）");
  lines.push("]");
  lines.push("```");
  lines.push("");
  lines.push(`无法执行的必做项置 \`completed=false\` 并附结构化 \`skip_reason\`（格式：\`${SKIP_REASON_FORMAT}\`）；` + `遗漏必做项或缺少证据/降级理由的 passed 提交会被门禁拒绝。`);
  if (stepId === "implement") {
    lines.push("implement 侧 `no_change` 整体豁免仅在本轮确无代码/配置变更时成立，工具会按变更检测核对事实；" + "部署注意点（规划文档未记载、实施时新发现）经 `deployment_notes` 逐条申报。");
  }
  lines.push("");
  return lines;
}
var STEP_ID_TO_CONTEXT_KIND = {
  analyze: "analyze",
  implement: "implement",
  verify_tool: "review_tool",
  verify_task: "review_task",
  verify_quality: "review_quality",
  verify_cleanup: "review_cleanup",
  quality_review: "review_merged"
};
function stepContextKind(stepId) {
  return STEP_ID_TO_CONTEXT_KIND[stepId];
}
function renderStepContext(item, step, ctxAgent, state, exemptionCtx) {
  if (!step)
    return [];
  const lines = [];
  switch (stepContextKind(step.id)) {
    case "analyze":
      lines.push(...renderConfirmMode(state));
      lines.push(...renderAnalyzeBlockers(item));
      break;
    case "implement":
      lines.push(...renderConfirmMode(state));
      lines.push(...renderDeveloperChildren(item, ctxAgent, exemptionCtx));
      break;
    case "review_tool":
      lines.push(...renderToolChildren(item, ctxAgent, exemptionCtx));
      break;
    case "review_task":
      lines.push(...renderTaskChildren(item, ctxAgent, exemptionCtx));
      break;
    case "review_quality":
      lines.push(...renderQualityChildren(item, ctxAgent, exemptionCtx));
      break;
    case "review_merged":
      lines.push(...renderMergedChildren(item, ctxAgent, exemptionCtx));
      break;
    case "review_cleanup":
      lines.push(...renderCleanupChildren(item, ctxAgent, exemptionCtx));
      break;
  }
  return lines;
}
function renderStepSemantics(step, common2, ctx) {
  if (!step)
    return [];
  const lines = [];
  const constraints = [...common2?.constraints ?? [], ...step.constraints ?? []];
  if (constraints.length > 0) {
    lines.push("## 约束", "");
    for (const c of constraints)
      lines.push(`- ${interpolateText(c, ctx)}`);
    lines.push("");
  }
  return lines;
}
function readBlockers(item) {
  const raw = item.metadata["blockers"];
  return Array.isArray(raw) ? raw : [];
}
function readTasks(item) {
  return taskListOf(item);
}
function readAgentSummaries(item) {
  const raw = item.metadata["agent_summaries"];
  return typeof raw === "object" && raw !== null ? raw : undefined;
}
function readExecutionBoundary(item) {
  const raw = item.metadata["execution_boundary"];
  return typeof raw === "object" && raw !== null ? raw : null;
}
function renderConfirmMode(state) {
  const unattended = state.unattended === true;
  return [
    "## 确认模式",
    "",
    unattended ? "- 当前：**无人值守**——不向用户提问，自行选择最优解继续" : "- 当前：**有人值守**——可直接向用户确认（需用户拍板时）",
    ""
  ];
}
function renderAnalyzeBlockers(item) {
  const blockers = readBlockers(item);
  if (blockers.length === 0)
    return [];
  const lines = ["## Blocker", ""];
  for (const b of blockers) {
    const status = b.status === "resolved" ? "✓ 已解决" : "⏳ 待用户答复";
    lines.push(`- Blocker #${b.id} | ${status} | ${b.category}`);
    lines.push(`  - 来源：${b.sourceRole}${b.taskId ? `；Task #${b.taskId}` : ""}`);
    lines.push(`  - 描述：${b.description}`);
    if (b.evidence)
      lines.push(`  - 证据：${b.evidence}`);
    if (b.attemptedActions)
      lines.push(`  - 已尝试：${b.attemptedActions}`);
    if (b.options.length > 0)
      lines.push(`  - 可选方案：${b.options.join("；")}`);
    if (b.userResponse)
      lines.push(`  - 用户答复：${b.userResponse}`);
    if (b.architectConclusion)
      lines.push(`  - 架构结论：${b.architectConclusion}`);
  }
  lines.push("");
  if (blockers.some((b) => b.status !== "resolved")) {
    lines.push("> 存在未解决 blocker：analyze step 无法以 passed 提交。请先经 blocker_updates 逐条置 resolved（user_response 填确认/裁决结论）后再提交。", "");
  }
  return lines;
}
function renderDeveloperChildren(item, ctxAgent, exemptionCtx) {
  const lines = [];
  lines.push(...renderBlockerTrail(item, BLOCKER_TRAIL_TITLE_DEV));
  const toFix = issueChildrenOf(item).filter((c) => isAgentOwnedIssue(c, ctxAgent));
  if (toFix.length === 0)
    return lines;
  renderTodoFixBlocks(lines, toFix, exemptionCtx);
  const highRefix = toFix.filter((c) => typeof c.metadata["refix_count"] === "number" && c.metadata["refix_count"] >= 2);
  if (highRefix.length > 0) {
    lines.push("## ⚠️ 修复多次未过的 issue", "");
    for (const c of highRefix) {
      const id = c.externalId ?? c.id.replace(/^issue:/, "");
      lines.push(`- Issue #${id}（已 ${c.metadata["refix_count"]} 次修复未过）`);
    }
    lines.push("");
  }
  return lines;
}
function isToolAdjudicable(child) {
  return child.metadata[EXEMPT_REQUEST_KEY] !== undefined && agentToReviewLayer(readIssueSource(child)) === "tool";
}
function isTaskAdjudicable(child) {
  return child.metadata[EXEMPT_REQUEST_KEY] !== undefined && agentToReviewLayer(readIssueSource(child)) === "task";
}
function isQualityAdjudicable(child, dimension, ctxAgent) {
  if (child.metadata[EXEMPT_REQUEST_KEY] === undefined)
    return false;
  if (dimension)
    return agentToReviewDimension(readIssueSource(child) ?? "") === dimension;
  if (ctxAgent)
    return readIssueSource(child) === ctxAgent;
  return false;
}
function isAdjudicableExempt(child, layer, ctxAgent) {
  if (layer === "quality")
    return isQualityAdjudicable(child, agentToDimension(ctxAgent), ctxAgent);
  if (layer === "tool")
    return isToolAdjudicable(child);
  if (layer === "task")
    return isTaskAdjudicable(child);
  return false;
}
function isAgentOwnedIssue(child, ctxAgent) {
  const f = resolveChildIssueFields(child);
  const layer = agentToReviewLayer(ctxAgent);
  if (!layer) {
    return child.phase === "todo" && child.metadata[EXEMPT_REQUEST_KEY] === undefined;
  }
  if (child.phase !== "review" || child.metadata[EXEMPT_REQUEST_KEY] !== undefined)
    return false;
  if (f.sourcePhase !== layer)
    return false;
  if (layer === "quality") {
    const dim = agentToReviewDimension(ctxAgent);
    if (!dim) {
      return readIssueSource(child) === ctxAgent;
    }
    return agentToReviewDimension(readIssueSource(child) ?? "") === dim;
  }
  return true;
}
function toolPendingChildren(item, ctxAgent) {
  const issues = issueChildrenOf(item);
  return {
    active: issues.filter((c) => isAgentOwnedIssue(c, ctxAgent)),
    pending: issues.filter((c) => isToolAdjudicable(c))
  };
}
function renderToolChildren(item, ctxAgent, exemptionCtx) {
  const { active, pending } = toolPendingChildren(item, ctxAgent);
  const lines = [];
  lines.push(...renderChildrenSection("Issue (待复核)", active, exemptionCtx));
  lines.push(...renderChildrenSection("Issue (待裁定是否可豁免)", pending, exemptionCtx));
  return lines;
}
var EVIDENCE_KIND_LABELS = {
  tool_review: { title: "自上次工具检查", lastCheck: "上次工具检查" },
  merged_review: { title: "自上次合并审查", lastCheck: "上次合并审查" }
};
function renderToolChangesEvidence(item, tg, toolChanges, kind) {
  const label = EVIDENCE_KIND_LABELS[kind];
  const checkpoint = typeof item.metadata["_tool_review_checkpoint"] === "string" ? item.metadata["_tool_review_checkpoint"] : undefined;
  const baseRef = tg.baseRef ?? undefined;
  const rangeRef = checkpoint ?? baseRef;
  const lines = [`## 本次变更证据（${label.title}）`, ""];
  if (toolChanges.scopeFull) {
    lines.push("- **口径**: 全量代码库审查（独立审查 full 形态）——无区间界定，工具检查与审查覆盖整个代码库", "");
    return [lines.join(`
`)];
  }
  if (checkpoint) {
    lines.push(`- **口径**: 本次为「${label.title}（${checkpoint}..HEAD）」的增量区间（含已提交与未提交的非 openspec 变更）；` + `与上方「变更范围」（${baseRef ?? "(无)"}..HEAD 本任务组累计口径）不同`, "");
  } else if (baseRef) {
    lines.push(`- **口径**: 本次区间以基线（${baseRef}..HEAD）兜底，与上方「变更范围」一致（首次进入，无${label.lastCheck}记录；` + "含已提交与未提交的非 openspec 变更）", "");
  } else {
    lines.push("- **口径**: 无检查点且无基线基准，无法界定已提交变更区间；本次变更仅按检出文件与未提交变更提示", "");
  }
  if (toolChanges.files.length > 0) {
    lines.push("- **变更文件清单**:", "");
    for (const f of toolChanges.files)
      lines.push(`  - \`${f}\``);
    lines.push("");
  } else {
    lines.push("- **变更文件清单**: （本区间未检出非 openspec 变更文件）", "");
  }
  if (rangeRef) {
    lines.push(`- **查看本次区间 diff**: \`git -C ${tg.worktreePath} diff ${rangeRef}..HEAD\``);
    lines.push("  - 该命令仅覆盖已提交区间；若存在未提交变更，另用 `git status` / `git diff` 查看工作区改动");
    lines.push("");
  }
  lines.push("");
  return lines;
}
function renderToolDirectSubmit(exemptedHits) {
  const lines = [
    "# ✅ 当前轮到你执行",
    "",
    "自上次工具检查后，worktree 无代码/配置变更（仅 openspec 文档变更或无变更），本层亦无待复核/待裁定 issue。",
    ""
  ];
  if ((exemptedHits ?? 0) > 0) {
    lines.push(`> **存量豁免提示**：本 change 存在 ${exemptedHits} 个命中项目级跨 change 豁免清单的存量问题（已按 Info 处理，不阻塞、无需重复豁免）。`, "");
  }
  lines.push("无需运行全量工具检查。", "", "## 操作指引", "", "1. 提交前须申报本轮必做清单处理结果：以一条 `step` 名首段为 `no_change` 的 `must_do_checks` 条目声明本轮整体豁免必做清单（completed=false，并附结构化 skip_reason 注明判定依据），或按视图「本 step 必做清单」逐项申报（completed=true 附执行结果；无法执行项置 completed=false + 结构化 skip_reason）", `2. 结构化 skip_reason 格式：\`${SKIP_REASON_FORMAT}\``, `3. 调用 \`opx_agent_submit({ step_id: "verify_tool", verdict: "passed", must_do_checks: <必做清单申报结果> })\` 提交通过后结束会话。`, "");
  return lines.join(`
`);
}
function renderToolAdjudicateOnly(item, rec, ctxAgent, exemptedHits, exemptionCtx) {
  const lines = [
    "# ✅ 当前轮到你执行",
    "",
    "自上次工具检查后，worktree 无代码/配置变更，无需运行全量工具检查。",
    ""
  ];
  if ((exemptedHits ?? 0) > 0) {
    lines.push(`> **存量豁免提示**：本 change 存在 ${exemptedHits} 个命中项目级跨 change 豁免清单的存量问题（已按 Info 处理，不阻塞、无需重复豁免）。`, "");
  }
  lines.push("仅处理以下本层待复核 / 待裁定项，处理完成后提交：", "");
  lines.push(...renderToolChildren(item, ctxAgent, exemptionCtx));
  lines.push("## 操作指引", "");
  lines.push("1. 逐项复核/裁定上方各项：待复核 issue 经 `recheck_adjudications` 复核（通过置 done、不通过驳回并附驳回原因）；待裁定豁免经 `exempt_adjudications` 裁定（dismissed/rejected）");
  lines.push("2. 提交前须申报本轮必做清单处理结果：以一条 `step` 名首段为 `no_change` 的 `must_do_checks` 条目声明本轮整体豁免必做清单（completed=false + 结构化 skip_reason 注明判定依据），或按视图「本 step 必做清单」逐项申报");
  lines.push(`3. 结构化 skip_reason 格式：\`${SKIP_REASON_FORMAT}\``);
  lines.push(`4. 全部处理完成 → commit → \`opx_agent_submit({ step_id: "${rec.stepId}", verdict: "passed", must_do_checks: <必做清单申报结果> })\``);
  lines.push("");
  return lines.join(`
`);
}
var BLOCKER_TRAIL_TITLE_REVIEW = "## Blocker 留痕（人工/不可验证任务的申报依据）";
var BLOCKER_TRAIL_TITLE_DEV = "## Blocker 留痕（已处理 blocker 的用户确认，凭记录申报完成）";
function renderBlockerTrail(item, title) {
  const resolved = readBlockers(item).filter((b) => b.status === "resolved" && b.userResponse);
  if (resolved.length === 0)
    return [];
  const lines = [title, ""];
  for (const b of resolved) {
    lines.push(`- Blocker #${b.id}${b.taskId ? ` | Task #${b.taskId}` : ""} | ${b.category}`);
    lines.push(`  - 描述：${b.description}`);
    lines.push(`  - 用户确认：${b.userResponse}`);
  }
  lines.push("");
  return lines;
}
function renderTaskChildren(item, ctxAgent, exemptionCtx) {
  const lines = [];
  const pendingTasks = readTasks(item).filter((t) => t.status === "submitted");
  if (pendingTasks.length > 0) {
    lines.push("## Task (待验证)", "");
    for (const t of pendingTasks)
      lines.push(renderTaskItem(t));
    lines.push("");
  }
  lines.push(...renderBlockerTrail(item, BLOCKER_TRAIL_TITLE_REVIEW));
  const issues = issueChildrenOf(item);
  const own = issues.filter((c) => isAgentOwnedIssue(c, ctxAgent));
  lines.push(...renderChildrenSection("Issue (待复核)", own, exemptionCtx));
  const pending = issues.filter((c) => isTaskAdjudicable(c));
  lines.push(...renderChildrenSection("Issue (待裁定是否可豁免)", pending, exemptionCtx));
  return lines;
}
function renderQualityChildren(item, ctxAgent, exemptionCtx) {
  const dimension = agentToDimension(ctxAgent);
  if (!dimension)
    return [];
  const issues = issueChildrenOf(item);
  const own = issues.filter((c) => isAgentOwnedIssue(c, ctxAgent));
  const lines = [];
  lines.push(...renderChildrenSection("Issue (待复核)", own, exemptionCtx));
  const pending = issues.filter((c) => isQualityAdjudicable(c, dimension, ctxAgent));
  lines.push(...renderChildrenSection("Issue (待裁定是否可豁免)", pending, exemptionCtx));
  return lines;
}
function renderMergedChildren(item, ctxAgent, exemptionCtx) {
  const lines = [];
  const pendingTasks = readTasks(item).filter((t) => t.status === "submitted");
  if (pendingTasks.length > 0) {
    lines.push("## Task (待验证)", "");
    for (const t of pendingTasks)
      lines.push(renderTaskItem(t));
    lines.push("");
  }
  lines.push(...renderBlockerTrail(item, BLOCKER_TRAIL_TITLE_REVIEW));
  const issues = issueChildrenOf(item);
  const own = issues.filter((c) => isAgentOwnedIssue(c, ctxAgent));
  lines.push(...renderChildrenSection("Issue (待复核)", own, exemptionCtx));
  const pending = issues.filter((c) => isQualityAdjudicable(c, agentToDimension(ctxAgent), ctxAgent));
  lines.push(...renderChildrenSection("Issue (待裁定是否可豁免)", pending, exemptionCtx));
  return lines;
}
function renderCleanupChildren(item, ctxAgent, exemptionCtx) {
  const issues = issueChildrenOf(item);
  const lines = [];
  const toFix = issues.filter((c) => isAgentOwnedIssue(c, ctxAgent));
  renderTodoFixBlocks(lines, toFix, exemptionCtx);
  const ownReview = issues.filter((c) => readIssueSource(c) === ctxAgent && c.phase === "review" && c.metadata[EXEMPT_REQUEST_KEY] === undefined);
  lines.push(...renderChildrenSection("Issue (自报待复核 · 本 step 自行复核裁定)", ownReview, exemptionCtx));
  const ownPending = issues.filter((c) => readIssueSource(c) === ctxAgent && c.metadata[EXEMPT_REQUEST_KEY] !== undefined);
  lines.push(...renderChildrenSection("Issue (自报豁免申请 · 待自行裁定)", ownPending, exemptionCtx));
  return lines;
}
function agentToDimension(agent) {
  return agentToReviewDimension(agent);
}
function renderChildrenSection(title, children, exemptionCtx) {
  if (children.length === 0)
    return [];
  const lines = [`## ${title}`, ""];
  for (const c of children)
    lines.push(renderChildIssue(c, exemptionCtx));
  lines.push("");
  return lines;
}
function renderTodoFixBlocks(lines, toFix, exemptionCtx) {
  const blocking = toFix.filter((c) => isBlockingSeverity(c.severity));
  const info = toFix.filter((c) => !isBlockingSeverity(c.severity));
  if (blocking.length > 0) {
    lines.push(...renderChildrenSection("Issue (待修复 · Low 及以上，必办)", blocking, exemptionCtx));
  }
  if (info.length > 0) {
    lines.push(...renderChildrenSection("Issue (待修复 · Info，建议修复，不阻塞提交)", info, exemptionCtx));
  }
}
function appendExemptionHints(lines, child, f, exemptionCtx) {
  const rule = typeof child.metadata["rule"] === "string" ? child.metadata["rule"] : "";
  if (f.sourcePhase === "tool" && rule === "") {
    lines.push("  - 无规则名：豁免结论不会写入跨 change 清单，下个 change 将重新报此问题");
  }
  if (exemptionCtx && rule !== "" && f.file !== "" && child.metadata[EXEMPTED_HIT_KEY] === undefined) {
    const hitLine = exemptionCtx.ruleFileLines.get([rule, f.file].join("\x00"));
    if (hitLine !== undefined && hitLine !== f.line) {
      lines.push(`  - 疑似行号漂移：豁免清单记录 line=${hitLine}，当前报 line=${f.line}，请核对是否同一问题`);
    }
  }
}
function renderChildIssue(child, exemptionCtx) {
  const f = resolveChildIssueFields(child);
  const id = child.externalId ?? child.id.replace(/^issue:/, "");
  const rule = typeof child.metadata["rule"] === "string" ? ` | ${child.metadata["rule"]}` : "";
  const lines = [
    `- Issue #${id}${rule ? ` | ${rule}` : ""}`
  ];
  if (f.file)
    lines.push(`  - 文件：${formatFilePath(f.file, f.line)}`);
  lines.push(`  - 描述：${child.description}`);
  appendExemptionHints(lines, child, f, exemptionCtx);
  if (child.metadata[EXEMPTED_HIT_KEY] !== undefined) {
    const rule2 = typeof child.metadata[EXEMPTED_HIT_KEY] === "string" ? child.metadata[EXEMPTED_HIT_KEY] : "";
    lines.push(`  - ⚠️ 命中项目级豁免清单${rule2 ? `（rule=${rule2}）` : ""}的存量问题，已按 Info 处理，无需重复豁免`);
  }
  if (typeof child.metadata["suggestion"] === "string")
    lines.push(`  - 建议：${child.metadata["suggestion"]}`);
  if (typeof child.metadata["reject_reason"] === "string")
    lines.push(`  - 驳回原因：${child.metadata["reject_reason"]}`);
  if (typeof child.metadata["refix_count"] === "number")
    lines.push(`  - 修复未过次数：${child.metadata["refix_count"]}`);
  if (child.metadata[EXEMPT_REQUEST_KEY] !== undefined)
    lines.push("  - 豁免申请中：等待裁定");
  return lines.join(`
`);
}

// src/core/tools/lifecycle.ts
function taskChildFromParsed(p, index) {
  const child = createInitialWorkItem({
    id: String(index + 1),
    source: "openspec",
    externalId: p.taskNumber,
    type: "task",
    title: p.title,
    description: p.title
  });
  child.metadata["specTrace"] = p.specTrace;
  child.metadata["taskNumber"] = p.taskNumber;
  return child;
}
function syncTaskChildren(item, parsed, opts) {
  const seen = new Set;
  const deduped = [];
  for (const c of item.children) {
    if (c.type === "task") {
      if (seen.has(c.id))
        continue;
      seen.add(c.id);
    }
    deduped.push(c);
  }
  item.children = deduped;
  const prev = new Map(taskChildrenOf(item).map((c) => [c.id, c]));
  const built = parsed.map((p, i) => {
    const id = String(i + 1);
    const old = prev.get(id);
    if (old && !opts.forceOpen) {
      old.title = p.title;
      old.description = p.title;
      old.externalId = p.taskNumber;
      old.metadata["specTrace"] = p.specTrace;
      old.metadata["taskNumber"] = p.taskNumber;
      return old;
    }
    const child = taskChildFromParsed(p, i);
    if (!opts.forceOpen && opts.defaultStatus)
      child.phase = opts.defaultStatus;
    return child;
  });
  item.children = [...item.children.filter((c) => c.type !== "task"), ...built];
}
function taskStatusToPhase(status) {
  switch (status) {
    case "submitted":
      return "review";
    case "verified":
      return "done";
    case "rejected":
      return "todo";
    default:
      return "todo";
  }
}
function migrateLegacyTasks(item) {
  const raw = item.metadata["tasks"];
  if (!Array.isArray(raw))
    return;
  if (taskChildrenOf(item).length === 0) {
    for (const t of raw) {
      const child = createInitialWorkItem({
        id: String(t.id),
        source: "openspec",
        externalId: t.taskNumber || undefined,
        type: "task",
        title: t.title,
        description: t.title
      });
      child.metadata["specTrace"] = t.specTrace;
      if (t.taskNumber)
        child.metadata["taskNumber"] = t.taskNumber;
      if (t.rejectReason)
        child.metadata["reject_reason"] = t.rejectReason;
      child.phase = taskStatusToPhase(t.status);
      item.children.push(child);
    }
  }
  delete item.metadata["tasks"];
}
function hasUnresolvedBlocker(item) {
  const raw = item.metadata["blockers"];
  if (!Array.isArray(raw))
    return false;
  return raw.some((b) => b?.status !== "resolved");
}
function closeUnresolvedBlockers(item, reason) {
  const raw = item.metadata["blockers"];
  if (!Array.isArray(raw))
    return 0;
  let closed = 0;
  for (const b of raw) {
    if (!b || b.status === "resolved")
      continue;
    b.status = "resolved";
    b.userResponse = reason;
    b.architectConclusion = reason;
    closed++;
  }
  return closed;
}
function firstUnpassedReviewStep(item, workflow) {
  const review = workflow.phases.find((p) => p.name === "review");
  if (!review)
    return null;
  for (const step of review.steps) {
    if (adjudicateStep(item, step) !== "passed")
      return step.id;
  }
  return null;
}
function applyRecoveryState(item, recovery, parsedTasks, state) {
  delete item.metadata["_advance_block_reason"];
  resetInternalRetryCount(item);
  delete item.metadata["_checkpoint"];
  if (state.kind === "review") {
    const phase2 = recovery?.phase;
    if (!phase2 || phase2 === "dev_impl") {
      item.phase = "in_progress";
      item.currentStep = "implement";
      item.tags = {};
      return 0;
    }
    item.phase = "review";
    item.tags["implement:openspec-developer"] = "passed";
    for (const key of Object.keys(item.tags)) {
      if (key.startsWith("verify_tool:") || key.startsWith("verify_task:") || key.startsWith("verify_quality:") || key.startsWith("quality_review:")) {
        if (item.tags[key] !== "passed")
          delete item.tags[key];
      }
    }
    for (const stepId of recovery?.reset_steps ?? []) {
      clearStepTags(item, stepId);
    }
    const workflow2 = loadWorkflowFile(resolveWorkflowPath(state));
    item.currentStep = firstUnpassedReviewStep(item, workflow2);
    if (item.currentStep === null)
      item.phase = "done";
    return 0;
  }
  const mode = state.mode;
  const phase = recovery?.phase;
  if (!phase || phase === "task_analysis" || phase === "dev_impl") {
    item.phase = "in_progress";
    item.currentStep = "implement";
    item.tags = {};
    const closedBlockers = phase === "task_analysis" ? closeUnresolvedBlockers(item, "随任务组重制处理") : 0;
    if (!phase || phase === "task_analysis") {
      syncTaskChildren(item, parsedTasks, { forceOpen: true });
    } else {
      syncTaskChildren(item, parsedTasks, { defaultStatus: "todo" });
    }
    return closedBlockers;
  }
  if (mode === "simple") {
    item.phase = "review";
    item.tags["implement:openspec-developer"] = "passed";
    for (const key of Object.keys(item.tags)) {
      if (key.startsWith("quality_review:")) {
        if (item.tags[key] !== "passed")
          delete item.tags[key];
      }
    }
    if ((recovery?.reset_steps ?? []).includes("quality_review")) {
      clearStepTags(item, "quality_review");
    }
    const workflow2 = loadWorkflowFile(resolveWorkflowPath(state));
    item.currentStep = firstUnpassedReviewStep(item, workflow2);
    if (item.currentStep === null) {
      const unfinishedTasks = item.children.filter((child) => child.type === "task" && !isTerminalPhase(child.phase));
      if (unfinishedTasks.length === 0) {
        item.phase = "done";
      } else {
        item.currentStep = "quality_review";
      }
    }
    syncTaskChildren(item, parsedTasks, { defaultStatus: "done" });
    return 0;
  }
  item.phase = "review";
  item.tags["implement:openspec-developer"] = "passed";
  for (const key of Object.keys(item.tags)) {
    if (key.startsWith("verify_tool:") || key.startsWith("verify_task:") || key.startsWith("verify_quality:")) {
      if (item.tags[key] !== "passed")
        delete item.tags[key];
    }
  }
  for (const stepId of recovery?.reset_steps ?? []) {
    clearStepTags(item, stepId);
  }
  if (recovery?.review_layer === "task" || recovery?.review_layer === "quality") {
    item.tags["verify_tool:openspec-reviewer-tool"] = "passed";
  }
  if (recovery?.review_layer === "quality") {
    item.tags["verify_task:openspec-reviewer-task"] = "passed";
  }
  const workflow = loadWorkflowFile(resolveWorkflowPath({ mode }));
  item.currentStep = firstUnpassedReviewStep(item, workflow);
  if (item.currentStep === null) {
    const unfinishedTasks = item.children.filter((child) => child.type === "task" && !isTerminalPhase(child.phase));
    if (unfinishedTasks.length === 0) {
      item.phase = "done";
    } else {
      item.currentStep = "verify_quality";
    }
  }
  syncTaskChildren(item, parsedTasks, { defaultStatus: "done" });
  return 0;
}
function assertValidRecovery(recovery) {
  if (recovery === undefined)
    return;
  if (!BUILD_PHASE_TARGETS.includes(recovery.phase)) {
    throw new Error(`recovery.phase 不合法，合法值：${BUILD_PHASE_TARGETS.join("、")}。传入值："${String(recovery.phase)}"。`);
  }
  if (recovery.review_layer !== undefined && !REVIEW_LAYERS.includes(recovery.review_layer)) {
    throw new Error(`recovery.review_layer 不合法，合法值：${REVIEW_LAYERS.join("、")}。传入值："${String(recovery.review_layer)}"。`);
  }
  if (recovery.review_layer && recovery.phase !== "review") {
    throw new Error(`review_layer 参数仅当 recovery.phase 为 review 时有效，当前 phase 为 "${recovery.phase}"。`);
  }
  if (recovery.reset_steps !== undefined) {
    if (recovery.phase !== "review") {
      throw new Error(`reset_steps 参数仅当 recovery.phase 为 review 时有效，当前 phase 为 "${recovery.phase}"。`);
    }
    if (recovery.review_layer) {
      throw new Error("reset_steps 与 review_layer 互斥，不可同时使用。");
    }
    if (recovery.reset_steps.length === 0) {
      throw new Error("reset_steps 不能为空数组，请至少指定一个审查 step。");
    }
  }
}
function assertValidResetStepValues(recovery, state) {
  if (!recovery?.reset_steps?.length)
    return;
  let valid;
  let formLabel;
  if (state.kind === "review") {
    if (state.reviewScope?.granularity === "simple") {
      valid = SIMPLE_REVIEW_STEPS;
      formLabel = "独立审查会话（simple 颗粒度）";
    } else {
      valid = REVIEW_VERIFY_STEPS;
      formLabel = "独立审查会话（thorough 颗粒度）";
    }
  } else if ((state.mode ?? "full") === "simple") {
    valid = SIMPLE_REVIEW_STEPS;
    formLabel = "simple 模式";
  } else {
    valid = REVIEW_VERIFY_STEPS;
    formLabel = "full 模式";
  }
  for (const stepId of recovery.reset_steps) {
    if (!valid.includes(stepId)) {
      throw new Error(`reset_steps 中的 step "${stepId}" 不属于当前会话形态（${formLabel}）的审查 step，` + `合法值：${valid.join("、")}。传入值："${stepId}"。`);
    }
  }
}
function otherTaskGroupsSettled(state, targetGroupId) {
  return state.workItems.filter((w) => w.id.startsWith("task:") && w.id !== `task:${targetGroupId}`).every(isTaskGroupSettled);
}
function normalizeSessionToken(s) {
  return s.replace(/[^A-Za-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "") || "head";
}
function deriveReviewSessionId(scope, currentBranch) {
  if (scope.scopeType === "pr") {
    return `review-pr-${normalizeSessionToken(scope.baseRef ?? "")}-${normalizeSessionToken(scope.headRef ?? "")}`;
  }
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `review-full-${normalizeSessionToken(currentBranch)}-${day}`;
}
function reviewScopeEquals(a, b) {
  return a.scopeType === b.scopeType && a.baseRef === b.baseRef && a.headRef === b.headRef && a.granularity === b.granularity && a.fix === b.fix;
}
async function assertLocalReviewBranch(worktree, branch, role) {
  if (typeof branch !== "string" || branch.trim() === "" || /\s/.test(branch)) {
    throw new Error(`独立审查会话的 ${role} 分支名不合法："${String(branch)}"。`);
  }
  if (branch.startsWith("origin/") || branch.startsWith("refs/remotes/")) {
    throw new Error(`独立审查会话的 ${role} 分支 "${branch}" 是远端引用：收尾合并只推进本地分支引用，远端引用会静默创建错误的本地分支。` + `请改用对应的本地分支名（如需审查远端内容，先在本地建分支跟踪后再传入）。`);
  }
  if (!await isLocalBranch(worktree, branch)) {
    const branches = await listLocalBranches(worktree);
    throw new Error(`独立审查会话的 ${role} 分支 "${branch}" 不是本地分支。当前本地分支：${branches.join("、") || "(无)"}。`);
  }
}
async function resolveReviewScope(worktree, raw) {
  const currentBranch = await getCurrentBranch(worktree);
  if (raw.scope_type !== "pr" && raw.scope_type !== "full") {
    throw new Error(`review_scope.scope_type 不合法，合法值：pr、full。传入值："${String(raw.scope_type)}"。`);
  }
  if (raw.granularity !== "simple" && raw.granularity !== "thorough") {
    throw new Error(`review_scope.granularity 不合法，合法值：simple、thorough。传入值："${String(raw.granularity)}"。`);
  }
  if (raw.fix !== "none" && raw.fix !== "fix") {
    throw new Error(`review_scope.fix 不合法，合法值：none、fix。传入值："${String(raw.fix)}"。`);
  }
  if (raw.scope_type === "full") {
    if (raw.base_ref || raw.head_ref) {
      throw new Error("review_scope.scope_type=full（全量审查）不接受 base_ref/head_ref——全量形态不界定分支区间。");
    }
    return { scope: { scopeType: "full", granularity: raw.granularity, fix: raw.fix }, currentBranch };
  }
  const headRef = raw.head_ref;
  if (!headRef)
    throw new Error("review_scope.scope_type=pr 必须提供 head_ref（审查目标分支，须为本地分支）。");
  let baseRef = raw.base_ref;
  if (!baseRef) {
    if (await isLocalBranch(worktree, "main"))
      baseRef = "main";
    else if (await isLocalBranch(worktree, "master"))
      baseRef = "master";
    else {
      const branches = await listLocalBranches(worktree);
      throw new Error(`review_scope 未传 base_ref 且无法自动推导（main 与 master 均不是本地分支）。请显式传入 base_ref。当前本地分支：${branches.join("、") || "(无)"}。`);
    }
  }
  await assertLocalReviewBranch(worktree, baseRef, "base_ref");
  await assertLocalReviewBranch(worktree, headRef, "head_ref");
  return { scope: { scopeType: "pr", baseRef, headRef, granularity: raw.granularity, fix: raw.fix }, currentBranch };
}
function createReviewWorkItem(scope, sessionId) {
  const item = createInitialWorkItem({
    id: `task:${REVIEW_TASK_GROUP_ID}`,
    source: "review",
    externalId: REVIEW_TASK_GROUP_ID,
    type: "task",
    title: "独立代码审查",
    description: "独立代码审查（不绑定 OpenSpec change）",
    labels: ["standalone-review"]
  });
  item.phase = "review";
  item.currentStep = scope.granularity === "thorough" ? "verify_tool" : "quality_review";
  item.metadata["name"] = "独立代码审查";
  item.metadata["task_count"] = 0;
  item.metadata["source"] = "review";
  item.metadata["review_session_id"] = sessionId;
  item.metadata[REVIEW_FIX_POLICY_KEY] = scope.fix;
  return item;
}
async function initReviewSession(params, ctx) {
  const args = params;
  if (args.change_id || args.task_group_id || args.base_branch || args.mode) {
    throw new Error("review_scope 与 change_id/task_group_id 是两种互斥入口（同传报错、都不传报错，二选一）；" + "base_branch 与 mode 仅 change 会话入口有效，独立审查会话不使用。");
  }
  if (args.recovery) {
    if (args.recovery.phase !== "review") {
      throw new Error(`独立审查会话的 recovery 仅支持 phase="review"（无分析阶段），传入值："${args.recovery.phase}"。`);
    }
    if (args.recovery.review_layer) {
      throw new Error("独立审查会话不支持 review_layer（按颗粒度整体审查），如需重置指定层请用 reset_steps。");
    }
    if (args.recovery.reopenIssues) {
      throw new Error("独立审查会话不支持 reopenIssues。");
    }
  }
  const { scope, currentBranch } = await resolveReviewScope(ctx.worktree, args.review_scope);
  const sessionId = deriveReviewSessionId(scope, currentBranch);
  let state = await readStateByChangeId(ctx.worktree, sessionId);
  if (state) {
    if (state.kind !== "review" || !state.reviewScope) {
      throw new Error(`会话 id "${sessionId}" 已被非独立审查会话占用，请核对后重试（防止误覆盖既有进度）。`);
    }
    if (!reviewScopeEquals(state.reviewScope, scope)) {
      throw new Error(`独立审查会话 "${sessionId}" 已存在且审查范围不同（已固化：${JSON.stringify(state.reviewScope)}，传入：${JSON.stringify(scope)}）。` + `会话 id 由审查范围推导，重复 init 仅支持同参数幂等复用；需不同范围请调整参数（id 随之变化）。`);
    }
    const stacksNote = adoptOrAssertSessionStacks(state, args);
    if (args.recovery) {
      const item = state.workItems.find((w) => w.id === `task:${REVIEW_TASK_GROUP_ID}`);
      if (!item)
        throw new Error(`工作项 "task:${REVIEW_TASK_GROUP_ID}" 缺失，会话状态异常，请核对 state 文件。`);
      assertValidResetStepValues(args.recovery, state);
      applyRecoveryState(item, args.recovery, [], state);
      await writeState(ctx.worktree, state);
      return `独立审查会话 "${sessionId}" 已恢复到 review 阶段（当前 step：${item.currentStep ?? "(已收口)"}）。后续工具以 change_id="${sessionId}" 传入。`;
    }
    if (stacksNote)
      await writeState(ctx.worktree, state);
    return [
      "独立审查会话已初始化（复用既有会话）。",
      "",
      `- **会话 ID**: \`${sessionId}\``,
      `- **说明**: 后续所有 opx_* 工具以 \`change_id="${sessionId}"\` 传入。`,
      ...stacksNote ? ["", stacksNote] : []
    ].join(`
`);
  }
  if (args.recovery) {
    throw new Error(`独立审查会话 "${sessionId}" 不存在，无法按 recovery 恢复。请先不带 recovery 初始化。`);
  }
  const baseBranch = scope.scopeType === "pr" ? scope.headRef : currentBranch;
  state = {
    changeId: sessionId,
    isolationNamespace: generateIsolationNamespace(sessionId),
    taskGroupId: REVIEW_TASK_GROUP_ID,
    baseBranch,
    workItems: [createReviewWorkItem(scope, sessionId)],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    kind: "review",
    reviewScope: scope,
    stacks: { project_stacks: args.project_stacks, project_frameworks: args.project_frameworks }
  };
  await writeState(ctx.worktree, state);
  const granularityLabel = scope.granularity === "thorough" ? "三层审查（工具检查 → 回归验证 → 五维度质量审查）" : "单层合并审查";
  const fixLabel = scope.fix === "fix" ? "审并修（失败回退修复后重审）" : "只审不修（issue 报告即交付物）";
  const scopeLabel = scope.scopeType === "pr" ? `PR 区间 ${scope.baseRef}..${scope.headRef}` : "全量代码库";
  return [
    "独立审查会话已初始化。",
    "",
    `- **会话 ID**: \`${sessionId}\``,
    `- **审查范围**: ${scopeLabel}`,
    `- **颗粒度**: ${granularityLabel}`,
    `- **修复策略**: ${fixLabel}`,
    "",
    `- **说明**: 后续所有 opx_* 工具以 \`change_id="${sessionId}"\` 传入（含 opx_orch_set_worktree / opx_status / opx_agent_submit / 收尾）。`
  ].join(`
`);
}
async function initReviewRecovery(params, state, ctx) {
  const args = params;
  if (args.mode || args.base_branch) {
    throw new Error("独立审查会话不使用 mode / base_branch 参数（审查范围在首次 init 经 review_scope 固化）。");
  }
  if (args.task_group_id && args.task_group_id !== REVIEW_TASK_GROUP_ID) {
    throw new Error(`独立审查会话的虚拟任务组固定为 "${REVIEW_TASK_GROUP_ID}"，传入值："${args.task_group_id}"。`);
  }
  if (args.recovery) {
    if (args.recovery.phase === "task_analysis") {
      throw new Error('独立审查会话无分析阶段，recovery.phase="task_analysis" 不适用（仅支持 review / dev_impl）。');
    }
    if (args.recovery.review_layer) {
      throw new Error("独立审查会话不支持 review_layer（按颗粒度整体审查），如需重置指定层请用 reset_steps。");
    }
    if (args.recovery.reopenIssues) {
      throw new Error("独立审查会话不支持 reopenIssues。");
    }
    assertValidResetStepValues(args.recovery, state);
  }
  const item = state.workItems.find((w) => w.id === `task:${REVIEW_TASK_GROUP_ID}`);
  if (!item)
    throw new Error(`工作项 "task:${REVIEW_TASK_GROUP_ID}" 缺失，会话状态异常，请核对 state 文件。`);
  const stacksNote = adoptOrAssertSessionStacks(state, args);
  if (args.recovery) {
    applyRecoveryState(item, args.recovery, [], state);
    await writeState(ctx.worktree, state);
    return `独立审查会话 "${state.changeId}" 已恢复到 ${args.recovery.phase} 阶段（当前 step：${item.currentStep ?? "(已收口)"}）。`;
  }
  if (stacksNote)
    await writeState(ctx.worktree, state);
  return [
    "独立审查会话已就绪（复用既有会话）。",
    "",
    `- **会话 ID**: \`${state.changeId}\``,
    `- **说明**: 后续所有 opx_* 工具以 \`change_id="${state.changeId}"\` 传入。`,
    ...stacksNote ? ["", stacksNote] : []
  ].join(`
`);
}
function sameTagSet(a, b) {
  const as = new Set(a);
  const bs = new Set(b);
  if (as.size !== bs.size)
    return false;
  for (const t of as)
    if (!bs.has(t))
      return false;
  return true;
}
function adoptOrAssertSessionStacks(state, args) {
  const next = {
    project_stacks: [...args.project_stacks],
    project_frameworks: [...args.project_frameworks]
  };
  if (state.stacks) {
    const same = sameTagSet(state.stacks.project_stacks, next.project_stacks) && sameTagSet(state.stacks.project_frameworks, next.project_frameworks);
    if (!same) {
      throw new Error(`会话已固化项目栈，变更请新建会话。
` + `已固化：project_stacks=${JSON.stringify(state.stacks.project_stacks)}、project_frameworks=${JSON.stringify(state.stacks.project_frameworks)}；
` + `本次传入：project_stacks=${JSON.stringify(next.project_stacks)}、project_frameworks=${JSON.stringify(next.project_frameworks)}。`);
    }
    return null;
  }
  state.stacks = next;
  return "已为旧会话补齐项目栈（skill 过滤与 must_do 门禁按本次声明生效）。";
}
var MAX_LISTED_KNOWN_TAGS = 10;
function assertProjectStacks(args) {
  for (const [name, raw] of [["project_stacks", args.project_stacks], ["project_frameworks", args.project_frameworks]]) {
    if (!Array.isArray(raw) || raw.length === 0 || raw.some((v) => typeof v !== "string" || v.trim() === "")) {
      throw new Error(`init 缺少必传参数或不合法：${name} 必须是非空字符串数组，元素取值为某个 skill frontmatter 声明的形态/框架标签。` + `两入口（change / review_scope）均必传，存入会话状态作为 skill 加载清单过滤与 must_do 门禁的过滤基准。`);
    }
  }
  const stackValues = knownStacks();
  const frameworkValues = knownFrameworks();
  if (stackValues.size === 0) {
    throw new Error("skill 索引中没有任何 skill 声明 stacks 标签，无法校验 project_stacks 值域。" + "请在 skill frontmatter 声明形态标签，或确认 skill 目录部署完整后重试。");
  }
  if (frameworkValues.size === 0) {
    throw new Error("skill 索引中没有任何 skill 声明 frameworks 标签，无法校验 project_frameworks 值域。" + "请在 skill frontmatter 声明框架标签，或确认 skill 目录部署完整后重试。");
  }
  for (const [name, values, known, label] of [
    ["project_stacks", args.project_stacks, stackValues, "形态标签（stacks）"],
    ["project_frameworks", args.project_frameworks, frameworkValues, "框架标签（frameworks）"]
  ]) {
    const unknown = values.filter((v) => !known.has(v));
    if (unknown.length > 0) {
      const available = Array.from(known).sort();
      const listed = available.slice(0, MAX_LISTED_KNOWN_TAGS);
      const truncated = available.length > listed.length ? ` 等（仅列前 ${MAX_LISTED_KNOWN_TAGS} 个）` : "";
      throw new Error(`${name} 中的值未命中当前 skill 索引中已由 skill 声明的${label}：${unknown.join("、")}。
` + `当前已由 skill 声明且可用的${label}共 ${available.length} 个：${listed.join("、")}${truncated}。
` + `形态（stacks）与框架（frameworks）分字段校验、不可混用；请传入任一 skill frontmatter 对应字段的声明值。`);
    }
  }
}
async function resolveChangeDocContent(repoRoot, state, changeId, baseBranch, relPath) {
  if (state) {
    const item = state.workItems.find((w) => w.id === `task:${state.taskGroupId}`);
    const worktreePath = item && typeof item.metadata["worktree_path"] === "string" ? item.metadata["worktree_path"] : null;
    if (worktreePath) {
      const p = path5.join(worktreePath, relPath);
      if (await pathExists(p)) {
        try {
          return await readFile4(p, "utf-8");
        } catch {}
      }
    }
  }
  const mainPath = path5.join(repoRoot, relPath);
  if (await pathExists(mainPath)) {
    try {
      return await readFile4(mainPath, "utf-8");
    } catch {}
  }
  const shown = await runGitChecked(repoRoot, ["show", `${baseBranch}:${relPath}`]);
  if (shown.success && shown.stdout.length > 0)
    return shown.stdout;
  return null;
}
async function initExecute(params, ctx) {
  assertOrchestrator(ctx, "opx_orch_init");
  const args = { ...params };
  if (typeof args.recovery === "string") {
    let parsed;
    try {
      parsed = JSON.parse(args.recovery);
    } catch {
      throw new Error(`recovery 参数解析失败：传入的字符串无法解析为对象。传入值：${args.recovery}`);
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(`recovery 参数解析失败：传入的字符串解析结果不是对象。传入值：${args.recovery}`);
    }
    args.recovery = parsed;
  }
  assertValidRecovery(args.recovery);
  assertProjectStacks(args);
  if (args.review_scope !== undefined) {
    return initReviewSession(args, ctx);
  }
  if (!args.change_id || !args.task_group_id) {
    if (args.change_id) {
      const existing = await readStateByChangeId(ctx.worktree, args.change_id);
      if (existing?.kind === "review") {
        return initReviewRecovery(args, existing, ctx);
      }
    }
    throw new Error("初始化需要两种入口之一：change 会话传 change_id + task_group_id；独立审查会话传 review_scope（会话 id 由审查范围推导并在返回体回传）。两种入口互斥，不可同传或都不传。");
  }
  const changeId = args.change_id;
  if (args.mode !== undefined && args.mode !== "full" && args.mode !== "simple") {
    throw new Error(`mode 参数不合法，合法值：full、simple。传入值："${String(args.mode)}"。`);
  }
  if (args.base_branch) {
    if (!args.base_branch.trim() || /\s/.test(args.base_branch)) {
      throw new Error(`base_branch 不合法："${args.base_branch}"。基准分支名不能为空或包含空白字符。`);
    }
    if (!await isLocalBranch(ctx.worktree, args.base_branch)) {
      const branches = await listLocalBranches(ctx.worktree);
      throw new Error(`base_branch "${args.base_branch}" 不是本地分支。当前本地分支：${branches.join("、") || "(无)"}。
` + `请传入已存在的本地分支名（远端分支请先在本地建分支跟踪后再传入）。`);
    }
  }
  const baseBranch = args.base_branch || await getCurrentBranch(ctx.worktree);
  let state = await readStateByChangeId(ctx.worktree, changeId);
  if (state && args.base_branch && args.base_branch !== state.baseBranch) {
    throw new Error(`base_branch 与已固化的基准分支不一致：已固化 "${state.baseBranch}"，本次传入 "${args.base_branch}"。
` + `基准分支在 init 时固化、不可中途变更（change 分支的 fork 源与收口合并目标都是它）。` + `请去掉 base_branch 参数沿用固化值，或重开 change。`);
  }
  const wasCurrentGroup = state?.taskGroupId === args.task_group_id;
  const stacksNote = state ? adoptOrAssertSessionStacks(state, args) : null;
  const fallbackBaseBranch = state?.baseBranch || baseBranch;
  const tasksContent = await resolveChangeDocContent(ctx.worktree, state, changeId, fallbackBaseBranch, `openspec/changes/${changeId}/tasks.md`);
  const parsedGroups = tasksContent === null ? [] : parseTaskGroupsFromContent(tasksContent);
  if (parsedGroups.length === 0) {
    throw new Error(`无法从 tasks.md 解析出任务组，请检查文件 openspec/changes/${changeId}/tasks.md。
` + `跨分支会话可重传 base_branch 或先恢复 worktree（opx_orch_set_worktree）后重试。`);
  }
  const targetGroup = parsedGroups.find((g) => g.id === args.task_group_id);
  if (!targetGroup) {
    throw new Error(`task_group_id "${args.task_group_id}" 不在 tasks.md 中。
可用 ID:
` + `- ${parsedGroups.map((g) => g.id).join(`
- `)}`);
  }
  const tasksByGroup = new Map;
  for (const g of parsedGroups) {
    tasksByGroup.set(g.id, parseTasksForGroupFromContent(tasksContent, g.id));
  }
  const clarifyContent = await resolveChangeDocContent(ctx.worktree, state, changeId, fallbackBaseBranch, `openspec/changes/${changeId}/clarify.md`);
  const clarifyBoundary = clarifyContent === null ? null : parseExecutionBoundary(clarifyContent, args.task_group_id);
  let modeSwitchNote = null;
  let legacyMigrationNote = null;
  let blockerResetNote = null;
  if (state && args.mode !== undefined && args.mode !== (state.mode ?? "full")) {
    const othersSettled = otherTaskGroupsSettled(state, args.task_group_id);
    const withinWindow = (args.task_group_id !== state.taskGroupId || args.recovery?.phase === "task_analysis") && othersSettled;
    if (!withinWindow) {
      throw new Error(`mode 参数与已固化的流程模式不一致：已固化 mode="${state.mode ?? "full"}"${state.mode === undefined ? "（旧变更未固化，读取时兜底 full）" : ""}，传入值："${args.mode}"。
` + `当前场景不允许切换流程模式：切换任务组须其他任务组均已完成或从未激活；重制当前组仅支持 recovery.phase="task_analysis"（其他任务组同样须已完成或从未激活）。
` + `请去掉 mode 参数继续沿用固化模式，或满足上述窗口条件后再切换。`);
    }
    const prevMode = state.mode;
    state.mode = args.mode;
    modeSwitchNote = `流程模式已从 ${prevMode ?? "full"} 切换为 ${args.mode}。`;
  }
  if (!state) {
    state = {
      changeId,
      isolationNamespace: generateIsolationNamespace(changeId),
      taskGroupId: args.task_group_id,
      baseBranch,
      workItems: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mode: args.mode ?? "simple",
      stacks: { project_stacks: args.project_stacks, project_frameworks: args.project_frameworks }
    };
  } else {
    state.baseBranch = state.baseBranch || baseBranch;
    state.isolationNamespace = state.isolationNamespace || generateIsolationNamespace(state.changeId);
  }
  assertValidResetStepValues(args.recovery, state);
  for (const group of parsedGroups) {
    const isCurrent = group.id === args.task_group_id;
    const groupTasks = tasksByGroup.get(group.id) ?? [];
    const existing = state.workItems.find((w) => w.id === `task:${group.id}`);
    const refreshMeta = (item2) => {
      item2.metadata["name"] = group.name;
      item2.metadata["task_count"] = group.taskCount;
      item2.metadata["source"] = "openspec";
      item2.metadata["relevant_specs"] = extractRelevantSpecsFromTasks(groupTasks);
    };
    if (existing)
      migrateLegacyTasks(existing);
    if (!isCurrent) {
      if (existing) {
        refreshMeta(existing);
      } else {
        const item2 = createInitialWorkItem({
          id: `task:${group.id}`,
          source: "openspec",
          externalId: group.id,
          type: "task",
          title: group.name,
          description: group.name,
          labels: ["openspec-change"]
        });
        item2.phase = "in_progress";
        item2.currentStep = "implement";
        syncTaskChildren(item2, groupTasks, { defaultStatus: "todo" });
        refreshMeta(item2);
        state.workItems.push(item2);
      }
      continue;
    }
    if (existing && !args.recovery && wasCurrentGroup) {
      refreshMeta(existing);
      syncTaskChildren(existing, groupTasks, {});
      delete existing.metadata["_advance_block_reason"];
      if (state.mode === "simple" && hasUnresolvedBlocker(existing)) {
        const closed = closeUnresolvedBlockers(existing, "simple 模式已不支持 blocker 状态机，随初始化关闭");
        blockerResetNote = `simple 模式已关闭 ${closed} 个未解决 blocker（旧版本遗留，随初始化处理）。`;
      }
      if (existing.phase === "todo" || existing.currentStep === "analyze") {
        if (hasUnresolvedBlocker(existing)) {
          legacyMigrationNote = "存在未解决 blocker，保留 analyze 回退步骤。";
        } else {
          existing.phase = "in_progress";
          existing.currentStep = "implement";
          for (const key of Object.keys(existing.tags)) {
            if (key.startsWith("analyze:"))
              delete existing.tags[key];
          }
          legacyMigrationNote = "已迁移旧在途会话：初始落点由 analyze 前移到 implement。";
        }
      }
      continue;
    }
    const item = existing ?? createInitialWorkItem({
      id: `task:${group.id}`,
      source: "openspec",
      externalId: group.id,
      type: "task",
      title: group.name,
      description: group.name,
      labels: ["openspec-change"]
    });
    if (args.recovery?.reopenIssues) {
      const closed = item.metadata["completed_at"] !== undefined || item.phase === "done";
      if (!closed) {
        throw new Error(`reopenIssues 仅支持已完成（completed）的任务组，当前 item.phase="${item.phase}"。`);
      }
      if (args.recovery.phase !== "dev_impl") {
        throw new Error("reopenIssues 仅支持恢复到 dev_impl 阶段。");
      }
      if (args.recovery.review_layer) {
        throw new Error("reopenIssues 与 review_layer 互斥，不可同时使用。");
      }
      for (const child of item.children) {
        if (isTerminalPhase(child.phase))
          continue;
        child.phase = "todo";
        child.metadata["reject_reason"] = child.metadata["reject_reason"] ?? "通过 reopenIssues 自动驳回";
      }
      for (const key of Object.keys(item.tags)) {
        if (key.startsWith("verify_"))
          delete item.tags[key];
      }
      delete item.metadata["completed_at"];
      item.metadata["worktree_path"] = null;
      item.metadata["branch_name"] = null;
      item.metadata["base_ref"] = null;
    }
    const regroupBlockersClosed = applyRecoveryState(item, args.recovery, groupTasks, state);
    if (regroupBlockersClosed > 0) {
      blockerResetNote = `任务组重制已关闭 ${regroupBlockersClosed} 个未解决 blocker（随重制处理）。`;
    }
    refreshMeta(item);
    if (!existing)
      state.workItems.push(item);
  }
  state.taskGroupId = args.task_group_id;
  let boundaryNote;
  const boundaryTarget = state.workItems.find((w) => w.id === `task:${args.task_group_id}`);
  if (!clarifyBoundary) {
    boundaryNote = "未从 clarify.md 解析到本任务组执行边界，实施视图按整个 worktree 处理。";
  } else if (boundaryTarget && boundaryTarget.metadata["execution_boundary"] === undefined) {
    boundaryTarget.metadata["execution_boundary"] = clarifyBoundary;
    boundaryNote = "已从 clarify.md 写入本任务组执行边界。";
  } else {
    boundaryNote = "本任务组已存在执行边界（来自 analyze 回退修订或 reviewer 边界扩展），未用 clarify.md 覆盖。";
  }
  await writeState(ctx.worktree, state);
  const parts = ["编排会话已初始化。"];
  if (args.recovery)
    parts.push(`已恢复到 ${args.recovery.phase} 阶段。`);
  if (blockerResetNote)
    parts.push(blockerResetNote);
  if (modeSwitchNote)
    parts.push(modeSwitchNote);
  if (legacyMigrationNote)
    parts.push(legacyMigrationNote);
  if (stacksNote)
    parts.push(stacksNote);
  parts.push(`

- **基准分支**: \`${state.baseBranch}\``);
  parts.push(`
- **执行边界**: ${boundaryNote}`);
  if (args.recovery?.review_layer && (state.mode ?? "full") === "simple") {
    parts.push(`

⚠️ simple 模式无 review 子层（仅 quality_review 单层审查），recovery.review_layer 参数未生效。`);
  }
  return parts.join("");
}
async function bindReviewWorktreeRefs(item, worktreePath, branch, state) {
  item.metadata["worktree_path"] = worktreePath;
  item.metadata["branch_name"] = branch;
  item.metadata["merge_target"] = state.baseBranch;
  if (state.reviewScope?.scopeType === "pr" && state.reviewScope.baseRef) {
    const baseRef = await getMergeBase(worktreePath, state.reviewScope.baseRef);
    if (baseRef) {
      item.metadata["base_ref"] = baseRef;
      return;
    }
  }
  delete item.metadata["base_ref"];
}
async function bindWorktreeRefs(item, worktreePath, branch) {
  item.metadata["worktree_path"] = worktreePath;
  item.metadata["branch_name"] = branch;
  const existing = item.metadata["scope_start_oid"];
  if (typeof existing !== "string" || !await isAncestor(worktreePath, existing, branch)) {
    const head = (await runGit(worktreePath, ["rev-parse", branch])).trim();
    if (!head)
      throw new Error(`worktree 绑定成功但无法获取 ${branch} 的 HEAD：${worktreePath}`);
    item.metadata["scope_start_oid"] = head;
  }
  item.metadata["base_ref"] = item.metadata["scope_start_oid"];
}
function deriveChangeBranch(changeId) {
  return `change/${normalizeSessionToken(changeId)}`;
}
async function ensureChangeBranch(repoRoot, branch, baseBranch) {
  if (await isLocalBranch(repoRoot, branch))
    return false;
  const created = await runGitChecked(repoRoot, ["branch", branch, baseBranch]);
  if (!created.success)
    throw new Error(`创建分支 "${branch}"（fork 自 ${baseBranch}）失败：${created.stderr}`);
  return true;
}
async function listFilesRecursive(root, prefix = "") {
  let entries = [];
  try {
    entries = await readdir(path5.join(root, prefix), { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      files.push(...await listFilesRecursive(root, rel));
    else if (entry.isFile())
      files.push(rel);
  }
  return files;
}
async function sha256OfFile(filePath) {
  return createHash2("sha256").update(await readFile4(filePath)).digest("hex");
}
async function removeEmptyDirs(root) {
  let entries = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory())
      await removeEmptyDirs(path5.join(root, entry.name));
  }
  try {
    await rmdir(root);
  } catch {}
}
function renderCrossBranchPlanCommittedBlocked(opts) {
  const { changeId, currentBranch, baseBranch } = opts;
  const changeDir = `openspec/changes/${changeId}`;
  const tmpWt = `/tmp/${normalizeSessionToken(changeId)}-${normalizeSessionToken(baseBranch)}`;
  return [
    `- **status**: blocked`,
    `- **原因**: 规划文档 \`${changeDir}/\` 已提交在当前检出分支 \`${currentBranch}\`，而基准分支 \`${baseBranch}\` 上没有该目录。change 工作副本从基准分支切出，会拿不到规划文档（后续解析任务组直接失败）；为避免把当前分支的规划文档搬成双份，本次未创建 worktree、未做任何改动。`,
    `- **处理**: 把规划文档提交到基准分支后再重试，例如 \`git worktree add ${tmpWt} ${baseBranch}\` 临时检出基准分支、在临时工作树内 \`git add ${changeDir} && git commit -m "docs(openspec): add ${changeId} plan"\`、完成后 \`git worktree remove ${tmpWt}\`；或改以当前分支 \`${currentBranch}\` 为 base_branch 重开 change。`
  ].join(`
`);
}
function planDetachedOnBaseNote(baseBranch, changeDir, localFileCount) {
  const localNote = localFileCount > 0 ? `，主仓库工作树里 ${localFileCount} 个同名副本未做处理` : "";
  return `- **规划文档**: 基准分支 \`${baseBranch}\` 上已有 \`${changeDir}/\`，worktree 自带，未做同步（主仓库处于 detached HEAD${localNote}）。`;
}
function renderDetachedPlanSyncBlocked(opts) {
  const changeDir = `openspec/changes/${opts.changeId}`;
  return [
    `- **status**: blocked`,
    `- **原因**: 主仓库处于 detached HEAD，无法判定当前检出分支；基准分支 \`${opts.baseBranch}\` 上没有 \`${changeDir}/\`，而主仓库工作树里该目录有 ${opts.fileCount} 个未提交文件需要同步进变更分支，规划文档同步未执行。`,
    `- **处理**: 请切到明确分支（如 \`git switch main\`）后重试；本次未创建新 worktree、未做任何改动。`
  ].join(`
`);
}
function renderBasePlanMismatchBlocked(opts) {
  const changeDir = `openspec/changes/${opts.changeId}`;
  return [
    `- **status**: blocked`,
    `- **原因**: 基准分支 \`${opts.baseBranch}\` 已有该 change 的规划文档且与当前工作树版本不一致，未做任何同步（避免覆盖基准分支已有内容或产生双份）。`,
    `- **处理**: 用 \`git diff ${opts.baseBranch} -- ${changeDir}\` 核对后人工提交到基准分支，或删除重复副本后重试。`
  ].join(`
`);
}
function renderStagedPlanBlocked(opts) {
  const changeDir = `openspec/changes/${opts.changeId}`;
  return [
    `- **status**: blocked`,
    `- **原因**: 主仓库工作树里 \`${changeDir}/\` 有已暂存未提交的条目（当前检出分支 \`${opts.currentBranch}\`），直接同步并删除主仓库副本会留下幽灵暂存条目；本次未创建 worktree、未做任何改动。`,
    `- **处理**: 先提交（\`git commit\`）或取消暂存（\`git restore --staged -- ${changeDir}\`）后重试。`
  ].join(`
`);
}
function planAlreadyOnBaseNote(baseBranch, changeDir) {
  return `- **规划文档**: 基准分支 \`${baseBranch}\` 已有同一 change 的规划文档（\`${changeDir}/\`，与当前工作树版本一致），worktree 自带，未做同步。`;
}
async function isSamePlanDocsAsBase(repoRoot, baseBranch, changeDir, basePaths, localFiles) {
  if (basePaths.length !== localFiles.length)
    return false;
  const baseSet = new Set(basePaths);
  const sourceDir = path5.join(repoRoot, changeDir);
  for (const rel of localFiles) {
    const relPath = `${changeDir}/${rel}`;
    if (!baseSet.has(relPath))
      return false;
    const baseOid = await blobOidInRef(repoRoot, baseBranch, relPath);
    const localOid = await hashObjectOfFile(repoRoot, path5.join(sourceDir, rel));
    if (baseOid !== localOid)
      return false;
  }
  return true;
}
async function resolveCrossBranchPlan(repoRoot, state, currentBranch) {
  const changeDir = `openspec/changes/${state.changeId}`;
  const basePaths = await listTreePaths(repoRoot, state.baseBranch, changeDir);
  const sourceDir = path5.join(repoRoot, changeDir);
  const localFiles = await pathExists(sourceDir) ? await listFilesRecursive(sourceDir) : [];
  if (basePaths.length > 0) {
    if (localFiles.length === 0)
      return { sync: false, skipNote: planAlreadyOnBaseNote(state.baseBranch, changeDir) };
    if (await isSamePlanDocsAsBase(repoRoot, state.baseBranch, changeDir, basePaths, localFiles)) {
      return { sync: false, skipNote: planAlreadyOnBaseNote(state.baseBranch, changeDir) };
    }
    return { blocked: renderBasePlanMismatchBlocked({ changeId: state.changeId, baseBranch: state.baseBranch }) };
  }
  if ((await listTreePaths(repoRoot, "HEAD", changeDir)).length > 0) {
    return {
      blocked: renderCrossBranchPlanCommittedBlocked({
        changeId: state.changeId,
        currentBranch,
        baseBranch: state.baseBranch
      })
    };
  }
  const statusRes = await runGitChecked(repoRoot, ["status", "--porcelain", "-uall", "--", changeDir]);
  if (!statusRes.success)
    throw new Error(`无法读取主仓库工作区状态：${statusRes.stderr}`);
  const nonUntracked = statusRes.stdout.split(`
`).map((l) => l.trim()).filter(Boolean).filter((l) => !l.startsWith("??"));
  if (nonUntracked.length > 0) {
    return { blocked: renderStagedPlanBlocked({ changeId: state.changeId, currentBranch }) };
  }
  return { sync: true };
}
async function resolveDetachedPlan(repoRoot, state) {
  const changeDir = `openspec/changes/${state.changeId}`;
  const basePaths = await listTreePaths(repoRoot, state.baseBranch, changeDir);
  const sourceDir = path5.join(repoRoot, changeDir);
  const localFiles = await pathExists(sourceDir) ? await listFilesRecursive(sourceDir) : [];
  if (basePaths.length > 0) {
    return { sync: false, skipNote: planDetachedOnBaseNote(state.baseBranch, changeDir, localFiles.length) };
  }
  if (localFiles.length === 0)
    return { sync: false };
  return {
    blocked: renderDetachedPlanSyncBlocked({
      changeId: state.changeId,
      baseBranch: state.baseBranch,
      fileCount: localFiles.length
    })
  };
}
async function syncChangePlanDocs(repoRoot, worktreePath, state) {
  const changeDir = `openspec/changes/${state.changeId}`;
  const sourceDir = path5.join(repoRoot, changeDir);
  if (!await pathExists(sourceDir))
    return "";
  const files = await listFilesRecursive(sourceDir);
  if (files.length === 0)
    return "";
  if (!await isWorktreeClean(worktreePath)) {
    throw new Error(`worktree "${worktreePath}" 存在未提交内容，无法同步主仓库规划文档。
` + `请先在该 worktree 内 commit 或 stash 后重试（主仓库副本未做任何删除）。`);
  }
  const hashes = new Map;
  for (const rel of files) {
    const src = path5.join(sourceDir, rel);
    const dst = path5.join(worktreePath, changeDir, rel);
    hashes.set(rel, await sha256OfFile(src));
    await mkdir(path5.dirname(dst), { recursive: true });
    await copyFile(src, dst);
  }
  const addResult = await runGitChecked(worktreePath, ["add", "--", changeDir]);
  if (!addResult.success) {
    throw new Error(`worktree 内规划文档 git add 失败（主仓库副本未删除）：${addResult.stderr}`);
  }
  const staged = await runGitChecked(worktreePath, ["diff", "--cached", "--name-only", "--", changeDir]);
  if (!staged.success) {
    throw new Error(`无法核对 worktree 暂存内容（主仓库副本未删除）：${staged.stderr}`);
  }
  const stagedFiles = staged.stdout.split(`
`).map((l) => l.trim()).filter(Boolean);
  let commitNote = "";
  if (stagedFiles.length > 0) {
    const commitResult = await runGitChecked(worktreePath, ["commit", "-m", "docs(openspec): sync change plan into change branch"]);
    if (!commitResult.success) {
      throw new Error(`worktree 内规划文档 git commit 失败（主仓库副本未删除，规划文档已复制到 worktree 但未提交）：${commitResult.stderr}
` + `请先在 worktree 内处理暂存区后重试。`);
    }
    const commitOid = (await runGit(worktreePath, ["rev-parse", "HEAD"])).trim();
    commitNote = commitOid ? `、commit \`${commitOid}\`` : "";
  }
  const committed = new Set(await listTreePaths(worktreePath, "HEAD", changeDir));
  const missing = files.filter((rel) => !committed.has(`${changeDir}/${rel}`));
  if (missing.length > 0) {
    throw new Error(`规划文档未全部提交到变更分支（缺少：${missing.join("、")}），已跳过删除主仓库副本。
` + `常见原因：文件被 .gitignore 忽略。请人工核对后执行 \`git -C '${worktreePath}' add -f -- ${changeDir}\` 并提交，` + `或删除主仓库未跟踪副本：\`rm -rf '${sourceDir}'\`。`);
  }
  const currentFiles = await listFilesRecursive(sourceDir);
  const snapshot = new Set(files);
  const extra = currentFiles.filter((rel) => !snapshot.has(rel));
  if (extra.length > 0) {
    throw new Error(`主仓库规划文档目录出现快照外新文件（${extra.join("、")}），已中止删除，未删除任何文件。
` + `请人工核对后删除主仓库副本：\`rm -rf '${sourceDir}'\`。`);
  }
  const changed = [];
  for (const rel of files) {
    const src = path5.join(sourceDir, rel);
    if (!await pathExists(src) || await sha256OfFile(src) !== hashes.get(rel))
      changed.push(rel);
  }
  if (changed.length > 0) {
    throw new Error(`主仓库规划文档在同步过程中被修改，已跳过删除（worktree 已提交，内容不会丢失）：${changed.join("、")}。
` + `请人工核对后删除主仓库未跟踪副本：\`rm -rf '${sourceDir}'\`。`);
  }
  for (const rel of files) {
    try {
      await rm2(path5.join(sourceDir, rel), { force: true });
    } catch (e) {
      throw new Error(`主仓库规划文档副本删除失败（${rel}）：${e instanceof Error ? e.message : String(e)}。
` + `worktree 已提交、内容安全，请人工删除主仓库副本：\`rm -rf '${sourceDir}'\`。`);
    }
  }
  await removeEmptyDirs(sourceDir);
  return `- **规划文档**: 已从主仓库工作树同步到变更分支（${files.length} 个文件${commitNote}），主仓库工作树副本已清理。`;
}
async function ensureChangeWorktree(repoRoot, state, item, branch, defaultPath, plan) {
  const applyPlan = async (worktreePath) => plan.sync ? await syncChangePlanDocs(repoRoot, worktreePath, state) : plan.skipNote;
  await ensureChangeBranch(repoRoot, branch, state.baseBranch);
  const wtList = await runGit(repoRoot, ["worktree", "list"]);
  const existingLine = wtList.split(`
`).find((l) => {
    const m = l.match(/^(\S+)\s+[0-9a-f]+\s+\[(.+?)\]/);
    return m && m[2].trim() === branch;
  });
  const registeredPath = existingLine ? existingLine.match(/^(\S+)/)?.[1] : undefined;
  const targetPath = registeredPath ?? defaultPath;
  if (!await pathExists(targetPath)) {
    await runGitChecked(repoRoot, ["worktree", "prune"]);
    await runGit(repoRoot, ["worktree", "add", targetPath, branch]);
    const planNote2 = await applyPlan(targetPath);
    await bindWorktreeRefs(item, targetPath, branch);
    return { path: targetPath, reused: false, planNote: planNote2 };
  }
  if (!registeredPath) {
    const addRes = await runGitChecked(repoRoot, ["worktree", "add", targetPath, branch]);
    if (!addRes.success) {
      throw new Error(`无法在 "${targetPath}" 就位 worktree：目录已存在且不是检出分支 "${branch}" 的 git worktree（git: ${addRes.stderr}）。
` + `请人工确认该目录内容并处理（删除或迁移）后重试。`);
    }
    const planNote2 = await applyPlan(targetPath);
    await bindWorktreeRefs(item, targetPath, branch);
    return { path: targetPath, reused: false, planNote: planNote2 };
  }
  const statusOut = await runGit(targetPath, ["status", "--porcelain"]);
  const dirtyPaths = statusOut.split(`
`).map((l) => l.trim()).filter(Boolean).map((l) => {
    const f = l.replace(/^\S+\s+/, "");
    return (f.includes(" -> ") ? f.split(" -> ").pop() : f).replace(/^"+|"+$/g, "");
  }).filter(Boolean);
  const codeDirty = dirtyPaths.filter((p) => !p.startsWith("openspec/"));
  if (codeDirty.length > 0) {
    throw new Error(`已有 worktree "${targetPath}" 存在未提交的代码文件变更（${codeDirty.join("、")}），无法自动处理。
` + `请先在该 worktree 内 commit 或 stash 后重试。`);
  }
  if (dirtyPaths.length > 0) {
    const addResult = await runGitChecked(targetPath, ["add", "--", ...dirtyPaths]);
    if (!addResult.success)
      throw new Error(`worktree openspec 目录 git add 失败：${addResult.stderr}`);
    const commitResult = await runGitChecked(targetPath, ["commit", "-m", "docs(openspec): auto-commit before worktree reuse"]);
    if (!commitResult.success)
      throw new Error(`worktree openspec 目录 git commit 失败：${commitResult.stderr}`);
  }
  const planNote = await applyPlan(targetPath);
  await bindWorktreeRefs(item, targetPath, branch);
  return { path: targetPath, reused: true, planNote };
}
async function setWorktreeExecute(params, ctx) {
  assertOrchestrator(ctx, "opx_orch_set_worktree");
  const state = await readStateByWorktree(ctx.worktree, params.change_id);
  if (!state)
    throw new Error("编排会话未初始化。请先调用 opx_orch_init。");
  const item = state.workItems.find((w) => w.id === `task:${state.taskGroupId}`);
  if (!item)
    throw new Error(`工作项 "task:${state.taskGroupId}" 缺失，请重新调用 opx_orch_init。`);
  const repoRoot = ctx.worktree;
  const isReview = state.kind === "review";
  const rawBranch = params.branch_name ?? "";
  if (rawBranch !== "") {
    const check = await runGitChecked(repoRoot, ["check-ref-format", "--branch", rawBranch]);
    if (!check.success) {
      throw new Error(`分支名 "${rawBranch}" 不合法，请修正后重试。`);
    }
  }
  const branch = rawBranch || (isReview ? `review/${state.changeId}` : deriveChangeBranch(state.changeId));
  if (!isReview) {
    const check = await runGitChecked(repoRoot, ["check-ref-format", "--branch", branch]);
    if (!check.success) {
      throw new Error(`派生分支名 "${branch}" 不合法（change_id="${state.changeId}"），请修正 change_id 或显式传入 branch_name。`);
    }
  }
  let wtPath;
  if (params.worktree_path) {
    wtPath = assertPathWithin(repoRoot, params.worktree_path, "worktree_path");
  } else {
    wtPath = isReview ? path5.join(repoRoot, ".worktree", state.changeId, "review") : path5.join(repoRoot, ".worktree", state.changeId, "ws");
  }
  const currentBranch = isReview ? "" : (await runGit(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"])).trim();
  const detached = !isReview && (currentBranch === "" || currentBranch === "HEAD");
  const crossBranch = !isReview && !detached && currentBranch !== state.baseBranch;
  let planSync = false;
  let planSkipNote = "";
  if (detached) {
    const plan = await resolveDetachedPlan(repoRoot, state);
    if (plan.blocked)
      return plan.blocked;
    planSkipNote = plan.skipNote ?? "";
  } else if (crossBranch) {
    const plan = await resolveCrossBranchPlan(repoRoot, state, currentBranch);
    if (plan.blocked)
      return plan.blocked;
    planSync = plan.sync ?? false;
    planSkipNote = plan.skipNote ?? "";
  }
  if (!detached && !crossBranch) {
    const changeStatus = await runGit(repoRoot, ["status", "--porcelain", `openspec/changes/${state.changeId}/`]);
    if (changeStatus.trim().length > 0) {
      const addResult = await runGitChecked(repoRoot, ["add", `openspec/changes/${state.changeId}/`]);
      if (!addResult.success)
        throw new Error(`change 目录 git add 失败：${addResult.stderr}`);
      const commitResult = await runGitChecked(repoRoot, ["commit", "-m", "docs(openspec): auto-commit before worktree setup"]);
      if (!commitResult.success)
        throw new Error(`change 目录 git commit 失败：${commitResult.stderr}`);
    }
  }
  let reused = false;
  let planNote = "";
  if (isReview) {
    const wtList = await runGit(repoRoot, ["worktree", "list"]);
    const existingLine = wtList.split(`
`).find((l) => {
      const m = l.match(/^(\S+)\s+[0-9a-f]+\s+\[(.+?)\]/);
      return m && m[2].trim() === branch;
    });
    const existingPath = existingLine ? existingLine.match(/^(\S+)/)?.[1] : undefined;
    if (existingPath) {
      const baseHead = await runGit(repoRoot, ["rev-parse", state.baseBranch]);
      const mergeResult = await runGitChecked(existingPath, ["merge", "--ff-only", baseHead]);
      if (mergeResult.success) {
        await bindReviewWorktreeRefs(item, existingPath, branch, state);
        reused = true;
      } else {
        const clean = await isWorktreeClean(existingPath);
        if (!clean) {
          throw new Error(`已有 worktree "${existingPath}" 与 ${state.baseBranch} 分叉且有未提交变更，无法自动 fast-forward。
` + `请手动处理后重试。`);
        }
        const localCommitCount = parseInt(await runGit(existingPath, ["rev-list", "--count", `${state.baseBranch}..HEAD`]), 10);
        if (localCommitCount > 0 || Number.isNaN(localCommitCount)) {
          await bindReviewWorktreeRefs(item, existingPath, branch, state);
          reused = true;
        } else {
          const cleanup = await removeTaskGroupWorktree(repoRoot, existingPath, { branchName: branch });
          if (!cleanup.dirResolved || cleanup.branchDeleted === false) {
            const problems = [];
            if (!cleanup.dirResolved)
              problems.push(`无法清理已有 worktree "${existingPath}"`);
            if (cleanup.branchDeleted === false)
              problems.push(`无法清理已有分支 "${branch}"`);
            throw new Error(`${problems.join("；")}：${cleanup.errors.join("；") || "原因未知"}
请手动处理后重试。`);
          }
        }
      }
    }
    if (!reused) {
      const forkBranch = state.baseBranch;
      await runGit(repoRoot, ["worktree", "add", "-b", branch, wtPath, forkBranch]);
      await bindReviewWorktreeRefs(item, wtPath, branch, state);
      if (state.reviewScope?.scopeType === "pr" && !item.metadata["base_ref"]) {
        throw new Error(`worktree 创建成功但无法获取 ${state.reviewScope.baseRef} 与 ${state.baseBranch} 的 merge-base：${wtPath}`);
      }
    }
  } else {
    const ensured = await ensureChangeWorktree(repoRoot, state, item, branch, wtPath, {
      sync: planSync,
      skipNote: planSkipNote
    });
    wtPath = ensured.path;
    reused = ensured.reused;
    planNote = ensured.planNote;
  }
  await writeState(ctx.worktree, state);
  const storedPath = typeof item.metadata["worktree_path"] === "string" ? item.metadata["worktree_path"] : null;
  if (storedPath) {
    await writeContextToWorktree(storedPath, state.changeId, state.taskGroupId);
  }
  return [
    `- **状态**: ${reused ? "复用已有 worktree" : "已创建 worktree"}`,
    `- **路径**: \`${item.metadata["worktree_path"]}\``,
    `- **分支**: \`${branch}\``,
    ...planNote ? ["", planNote] : []
  ].join(`
`);
}
async function statusExecute(params, ctx) {
  const agent = ctx.agent;
  const state = await readStateByWorktree(ctx.worktree, params.change_id);
  if (!state) {
    if (ctx.orchestrator) {
      const diskWts = await discoverDiskWorktrees(ctx.worktree);
      if (diskWts.length > 0) {
        const lines = ["# 编排进度", "", "**状态文件**: 未初始化", "", "## 磁盘 Worktree（可恢复进度）", ""];
        lines.push("| 分支 | 路径 |");
        lines.push("|------|------|");
        for (const w of diskWts)
          lines.push(`| ${w.branch} | \`${w.path}\` |`);
        lines.push("");
        lines.push("请用 question 工具询问用户确认恢复目标，然后调用 opx_orch_init(recovery=...)。");
        return lines.join(`
`);
      }
    }
    return "编排会话尚未初始化。请先调用 opx_orch_init。";
  }
  const item = state.workItems.find((w) => w.id === `task:${state.taskGroupId}`);
  if (!item) {
    return "编排会话未就绪：找不到活跃任务组的工作项，请重新调用 opx_orch_init。";
  }
  const workflow = loadWorkflowFile(resolveWorkflowPath(state));
  const rec = recommendForItem(item, workflow);
  const tg = findTaskGroup(state, state.taskGroupId);
  const mainPollution = ctx.orchestrator ? await detectMainRepoPollution(ctx.worktree) : null;
  let toolChanges;
  const changesEvidenceStep = rec.status === "recommend" && rec.agents.includes(agent) && (agentToReviewLayer(agent) === "tool" && rec.stepId === "verify_tool" || agent === "openspec-reviewer" && rec.stepId === "quality_review");
  if (changesEvidenceStep) {
    const wtPath = typeof item.metadata["worktree_path"] === "string" ? item.metadata["worktree_path"] : undefined;
    if (wtPath) {
      const checkpoint = typeof item.metadata["_tool_review_checkpoint"] === "string" ? item.metadata["_tool_review_checkpoint"] : undefined;
      const baseRef = typeof item.metadata["base_ref"] === "string" ? item.metadata["base_ref"] : undefined;
      const scopeFull = state.kind === "review" && state.reviewScope?.scopeType === "full";
      toolChanges = await detectChanges(wtPath, { checkpoint, baseRef, scopeFull });
    }
  }
  const exemptedHits = item.children.filter((c) => c.type === "issue" && c.metadata["exempted_hit"] !== undefined).length;
  const exemptionItems = (await readExemptions(ctx.worktree)).items;
  return renderWorkflowStatusView(item, workflow, rec, { agent, orchestrator: ctx.orchestrator, identityDeclared: ctx.identityDeclared }, { state, tg, mainPollution, toolChanges, exemptedHits, exemptionItems });
}
async function sweepEmptyWorktreeParents(repoRoot, removedDir, changeId) {
  const repoRootAbs = path5.resolve(repoRoot);
  const groupLevelDir = path5.join(repoRootAbs, ".worktree", changeId);
  const worktreeLevelDir = path5.join(repoRootAbs, ".worktree");
  if (path5.dirname(path5.resolve(removedDir)) === groupLevelDir) {
    try {
      await rmdir(groupLevelDir);
    } catch {}
  }
  try {
    await rmdir(worktreeLevelDir);
  } catch {}
}
function renderReviewIssueSummary(item) {
  const issues = item.children.filter((c) => c.type === "issue");
  const lines = ["## 审查结果摘要", ""];
  if (issues.length === 0) {
    lines.push("- 未报出任何 issue。", "");
    return lines.join(`
`);
  }
  const bySeverity = new Map;
  const byDimension = new Map;
  for (const c of issues) {
    const sev = c.severity ?? "Info";
    const dim = String(c.metadata["dimension"] ?? "style");
    bySeverity.set(sev, (bySeverity.get(sev) ?? 0) + 1);
    byDimension.set(dim, (byDimension.get(dim) ?? 0) + 1);
  }
  lines.push(`- **issue 总数**: ${issues.length}`);
  lines.push(`- **按严重级别**: ${[...bySeverity.entries()].map(([k, v]) => `${k}=${v}`).join("、")}`);
  lines.push(`- **按维度**: ${[...byDimension.entries()].map(([k, v]) => `${k}=${v}`).join("、")}`);
  lines.push("");
  lines.push("| severity | dimension | 文件位置 | 描述 |", "|----------|-----------|----------|------|");
  for (const c of issues) {
    const file = typeof c.metadata["file"] === "string" ? c.metadata["file"] : "";
    const line = typeof c.metadata["line"] === "number" ? c.metadata["line"] : 0;
    const loc = file ? `${file}${line > 0 ? `:${line}` : ""}` : "(无)";
    lines.push(`| ${c.severity ?? "Info"} | ${String(c.metadata["dimension"] ?? "style")} | \`${loc}\` | ${c.description.replace(/\|/g, "\\|")} |`);
  }
  lines.push("");
  return lines.join(`
`);
}
var DOCUMENTATION_EXTENSIONS = [".md", ".mdx", ".markdown", ".rst", ".adoc"];
var DRIFT_NEUTRAL_PATH_PREFIXES = ["openspec/"];
async function isHarmlessDrift(worktree, sourceBranch, targetBranch, files) {
  if (files === null)
    return false;
  const versionCandidates = [];
  for (const f of files) {
    if (DOCUMENTATION_EXTENSIONS.some((ext) => f.endsWith(ext)))
      continue;
    if (DRIFT_NEUTRAL_PATH_PREFIXES.some((p) => f.startsWith(p)))
      continue;
    if (f === "package.json" || f.endsWith("/package.json")) {
      versionCandidates.push(f);
      continue;
    }
    return false;
  }
  for (const f of versionCandidates) {
    if (await isVersionOnlyDrift(worktree, sourceBranch, targetBranch, f) !== true)
      return false;
  }
  return true;
}
function rollbackToCleanupStep(item, workflow) {
  if (!workflow.stepMap.has("verify_cleanup"))
    return false;
  delete item.metadata["_advance_block_reason"];
  delete item.metadata["_checkpoint"];
  resetInternalRetryCount(item);
  clearStepTags(item, "verify_cleanup");
  delete item.metadata["scope_end_oid"];
  item.phase = "review";
  item.currentStep = "verify_cleanup";
  return true;
}
function renderFinalizeBlocked(reasons, handlings, opts) {
  const lines = [
    `- **status**: blocked`,
    ...reasons.map((r) => `- **原因**: ${r}`),
    `- **说明**: worktree 与变更分支 \`${opts.branchName}\` 已保留；未执行合并，无半成品状态。属多 change 并行推进的预期行为。` + (opts.rolledBack ? "本任务组状态已回退到收尾验证（verify_cleanup）。" : ""),
    ...handlings.map((h) => `- **处理**: ${h}`),
    "",
    "重新查询 opx_status 获取分派指引。"
  ];
  if (opts.checkboxWarning)
    lines.push(opts.checkboxWarning);
  return lines.join(`
`);
}
async function completeTaskGroupExecute(params, ctx) {
  assertOrchestrator(ctx, "opx_orch_complete_task_group");
  const lockPath = await getLockPath(ctx.worktree, params.change_id);
  await acquireLock(lockPath);
  try {
    return await completeTaskGroupLocked(params, ctx);
  } finally {
    releaseLock(lockPath);
  }
}
async function completeTaskGroupLocked(params, ctx) {
  const state = await readStateByWorktree(ctx.worktree, params.change_id);
  if (!state)
    throw new Error("编排会话未初始化。请先调用 opx_orch_init。");
  const item = state.workItems.find((w) => w.id === `task:${state.taskGroupId}`);
  if (!item)
    throw new Error(`工作项 "task:${state.taskGroupId}" 缺失，请重新调用 opx_orch_init。`);
  if (item.phase !== "done" || item.metadata["completed_at"] !== undefined) {
    throw new Error(`阶段顺序错误：opx_orch_complete_task_group 需在 review 完成后调用。
` + `- item.phase=${item.phase}
` + `- completed_at=${item.metadata["completed_at"] ?? "(未设置)"}`);
  }
  const worktreePath = typeof item.metadata["worktree_path"] === "string" ? item.metadata["worktree_path"] : null;
  const branchName = typeof item.metadata["branch_name"] === "string" ? item.metadata["branch_name"] : null;
  if (worktreePath) {
    const clean = await isWorktreeClean(worktreePath);
    if (!clean)
      throw new Error(`worktree "${worktreePath}" 存在未 commit 内容，请先 commit 再完成任务组。`);
  }
  const isReview = state.kind === "review";
  const isReviewNone = isReview && state.reviewScope?.fix === "none";
  const openIssues = item.children.filter((c) => isBlockingSeverity(c.severity) && !isTerminalPhase(c.phase));
  if (!isReviewNone && openIssues.length > 0) {
    throw new Error(`存在 ${openIssues.length} 个 Low 及以上的未解决 issue 未处理，请先修复或申请豁免。`);
  }
  const openTasks = taskChildrenOf(item).filter((c) => !isTerminalPhase(c.phase));
  if (openTasks.length > 0) {
    throw new Error(`存在 ${openTasks.length} 个未完成 task。`);
  }
  const blockers = Array.isArray(item.metadata["blockers"]) ? item.metadata["blockers"] : [];
  const unresolvedBlockers = blockers.filter((blocker) => blocker.status !== "resolved");
  if (unresolvedBlockers.length > 0) {
    throw new Error(`存在 ${unresolvedBlockers.length} 个未解决 blocker，无法完成任务组。`);
  }
  let checkboxWarning = "";
  if (worktreePath) {
    try {
      await markTaskGroupCheckboxesComplete(worktreePath, params.change_id, state.taskGroupId);
    } catch (e) {
      checkboxWarning = `- **tasks.md 复选框勾选失败**: ${e instanceof Error ? e.message : String(e)}（不影响收尾）`;
    }
  }
  let archiveNote = "";
  if (!isReview && isFinalTaskGroup(state, item) && worktreePath && branchName) {
    const archiveRes = await archiveOpenspecChange(worktreePath, params.change_id);
    if (archiveRes.status === "archived") {
      archiveNote = `- **归档**: change 已通过 openspec archive 归档并提交（committed: ${archiveRes.committed ? "是" : "否"}）。`;
    } else if (archiveRes.status === "skipped") {
      archiveNote = `- **归档跳过**: ${archiveRes.reason}（不影响收口）。`;
    } else {
      const workflow = loadWorkflowFile(resolveWorkflowPath(state));
      const rolledBack = rollbackToCleanupStep(item, workflow);
      if (rolledBack)
        await writeState(ctx.worktree, state);
      return renderFinalizeBlocked([`openspec 归档失败：${archiveRes.error}`], [
        `在 worktree 内检查 \`git status\`：如归档残留未提交文件，视情况提交或还原，使 worktree 恢复干净。`,
        `归档依赖 git 身份（user.name/user.email），缺失时先配置再重试。`,
        `处理完成后重新提交收尾验证（opx_agent_submit，step_id="verify_cleanup"），通过后再调用 opx_orch_complete_task_group 重新收口（二次收口时归档幂等跳过）。`
      ], { branchName, mergeTarget: state.baseBranch, rolledBack, checkboxWarning });
    }
  }
  if (!isReview && worktreePath && branchName) {
    const endOid = (await runGit(worktreePath, ["rev-parse", branchName])).trim();
    if (endOid)
      item.metadata["scope_end_oid"] = endOid;
  }
  if (isReview) {
    return finalizeReviewSession(state, item, params, ctx, { worktreePath, branchName, isReviewNone, checkboxWarning });
  }
  if (!isFinalTaskGroup(state, item)) {
    item.metadata["completed_at"] = new Date().toISOString();
    await writeState(ctx.worktree, state);
    const doneMessage2 = `任务组已完成。本任务组变更保留在 change 分支上，待全部任务组完成后统一收口合并（本次不合并、不销毁 worktree）。若某任务组已确认不再执行，当前版本不支持取消任务组，须人工编辑编排 state 文件（openspec/states/${state.changeId}.json）将该任务组的 phase 改为 "cancelled"，收口合并才会触发。`;
    return checkboxWarning ? `${doneMessage2}
${checkboxWarning}` : doneMessage2;
  }
  const mergeTarget = state.baseBranch;
  let docDriftNote = "";
  if (branchName) {
    await ensureChangeBranch(ctx.worktree, branchName, mergeTarget);
    if (!await isAncestor(ctx.worktree, mergeTarget, branchName)) {
      const driftFiles = await listBranchDriftFiles(ctx.worktree, branchName, mergeTarget);
      if (!await isHarmlessDrift(ctx.worktree, branchName, mergeTarget, driftFiles)) {
        const workflow = loadWorkflowFile(resolveWorkflowPath(state));
        const rolledBack = rollbackToCleanupStep(item, workflow);
        if (rolledBack)
          await writeState(ctx.worktree, state);
        return renderFinalizeBlocked([
          `基准分支 \`${mergeTarget}\` 已推进（与变更分支 \`${branchName}\` 存在漂移）：基准分支最新提交未包含在变更分支历史中，直接合并会遗漏基准分支新内容。`
        ], [
          `在 worktree 内执行 \`git merge ${mergeTarget}\` 合入基准分支最新代码并解决冲突，完成回归验证后重新提交收尾验证（opx_agent_submit，step_id="verify_cleanup"），通过后再调用 opx_orch_complete_task_group 重新收口。`
        ], { branchName, mergeTarget, rolledBack, checkboxWarning });
      }
      const files = driftFiles ?? [];
      const driftList = files.length > 10 ? `${files.slice(0, 10).join(", ")} 等 ${files.length} 个` : files.join(", ");
      docDriftNote = `- **基准漂移（无代码语义）**: 基准分支 \`${mergeTarget}\` 相对变更分支切出点净变化 ${files.length} 个文件` + (files.length > 0 ? `（${driftList}）` : "") + "，均为文档、openspec 规划路径或仅版本号变更，不影响代码语义，未回退收尾验证直接合并。";
    }
    const mergeResult = await mergeBranchToTarget(ctx.worktree, branchName, mergeTarget);
    if (mergeResult.blockedMessage) {
      return [`- **status**: blocked`, mergeResult.blockedMessage].join(`
`);
    }
    if (!mergeResult.success) {
      const workflow = loadWorkflowFile(resolveWorkflowPath(state));
      const rolledBack = rollbackToCleanupStep(item, workflow);
      if (rolledBack)
        await writeState(ctx.worktree, state);
      return renderFinalizeBlocked([
        `变更分支 \`${branchName}\` 合并到 \`${mergeTarget}\` 时发生冲突，未产生任何变更（分支引用未动，无半成品合并）。`
      ], [
        `在 worktree 内执行 \`git merge ${mergeTarget}\` 合入基准分支最新代码解决冲突并提交，完成回归验证后重新提交收尾验证（opx_agent_submit，step_id="verify_cleanup"），通过后再调用 opx_orch_complete_task_group 重新收口。`
      ], { branchName, mergeTarget, rolledBack, checkboxWarning });
    }
  }
  let cleanupNote = "";
  let cleanupResidualWarning = "";
  if (worktreePath) {
    const cleanup = await removeTaskGroupWorktree(ctx.worktree, worktreePath, { branchName });
    if (cleanup.dirResolved) {
      await sweepEmptyWorktreeParents(ctx.worktree, worktreePath, params.change_id);
      const successNotes = [];
      if (cleanup.dirResolvedByFallback) {
        successNotes.push("- **cleanup**: git worktree remove 未直接移除目录，已按文件系统兜底删除并 prune 管理记录。");
      }
      if (cleanup.errors.length > 0) {
        successNotes.push(`- **cleanup 部分告警**: ${cleanup.errors.join("；")}`);
      }
      cleanupNote = successNotes.join(`
`);
    } else {
      item.metadata["cleanup_residual"] = { worktree_path: worktreePath, errors: cleanup.errors };
      cleanupResidualWarning = [
        "",
        "## ⚠️ worktree 清理残留（不影响收口）",
        `- **残留路径**: \`${worktreePath}\``,
        "- **原因**:",
        ...cleanup.errors.map((e) => `  - ${e}`),
        `- **处理**: 请人工执行 \`rm -rf '${worktreePath}' && git worktree prune\` 清理残留目录与 git 管理记录。`,
        branchName ? `- **分支**: 分支 "${branchName}" 未删除。` : ""
      ].filter(Boolean).join(`
`);
    }
  }
  item.metadata["completed_at"] = new Date().toISOString();
  await writeState(ctx.worktree, state);
  const notes = [docDriftNote, cleanupNote, archiveNote, checkboxWarning, cleanupResidualWarning].filter(Boolean);
  const doneMessage = branchName ? `任务组已完成并合并到 "${mergeTarget}"。` : "任务组已完成（无变更分支引用，跳过合并）。";
  return notes.length > 0 ? `${doneMessage}
${notes.join(`
`)}` : doneMessage;
}
async function finalizeReviewSession(state, item, params, ctx, refs) {
  const { worktreePath, branchName, isReviewNone, checkboxWarning } = refs;
  const mergeTarget = state.baseBranch;
  if (branchName && !isReviewNone) {
    const mergeResult = await mergeBranchToTarget(ctx.worktree, branchName, mergeTarget);
    if (mergeResult.blockedMessage) {
      return [`- **status**: blocked`, mergeResult.blockedMessage].join(`
`);
    }
    if (!mergeResult.success) {
      return [
        `- **status**: blocked`,
        `- **merge_conflict**: true`,
        `- **说明**: 合并到 "${mergeTarget}" 时发生冲突，未产生任何变更（分支引用未动，无半成品合并）。`,
        `- **处理**: 请自行执行 \`git checkout ${mergeTarget} && git merge ${branchName}\` 解决冲突并提交，完成后重新调用 opx_orch_complete_task_group 完成收尾（重调时工具会自动识别已合并并继续）。worktree 与分支已保留。`
      ].join(`
`);
    }
  }
  let cleanupNote = "";
  let cleanupResidualWarning = "";
  if (worktreePath) {
    const cleanup = await removeTaskGroupWorktree(ctx.worktree, worktreePath, { branchName });
    if (cleanup.dirResolved) {
      await sweepEmptyWorktreeParents(ctx.worktree, worktreePath, params.change_id);
      const successNotes = [];
      if (cleanup.dirResolvedByFallback) {
        successNotes.push("- **cleanup**: git worktree remove 未直接移除目录，已按文件系统兜底删除并 prune 管理记录。");
      }
      if (cleanup.errors.length > 0) {
        successNotes.push(`- **cleanup 部分告警**: ${cleanup.errors.join("；")}`);
      }
      cleanupNote = successNotes.join(`
`);
    } else {
      item.metadata["cleanup_residual"] = { worktree_path: worktreePath, errors: cleanup.errors };
      cleanupResidualWarning = [
        "",
        "## ⚠️ worktree 清理残留（不影响收尾）",
        `- **残留路径**: \`${worktreePath}\``,
        "- **原因**:",
        ...cleanup.errors.map((e) => `  - ${e}`),
        `- **处理**: 请人工执行 \`rm -rf '${worktreePath}' && git worktree prune\` 清理残留目录与 git 管理记录。`,
        branchName ? `- **分支**: 分支 "${branchName}" 未删除。` : ""
      ].filter(Boolean).join(`
`);
    }
  }
  item.metadata["completed_at"] = new Date().toISOString();
  await writeState(ctx.worktree, state);
  const notes = [cleanupNote, checkboxWarning, cleanupResidualWarning].filter(Boolean);
  const summary = renderReviewIssueSummary(item);
  const doneMessage = isReviewNone ? `独立审查会话已完成（只审模式，未合并，worktree 与分支已销毁）。` : `独立审查会话已完成并合并到 "${mergeTarget}"。`;
  return notes.length > 0 ? `${doneMessage}
${notes.join(`
`)}
${summary}` : `${doneMessage}
${summary}`;
}
async function setUnattendedExecute(params, ctx) {
  assertOrchestrator(ctx, "opx_orch_set_unattended");
  const state = await readStateByWorktree(ctx.worktree, params.change_id);
  if (!state)
    throw new Error("编排会话未初始化。请先调用 opx_orch_init。");
  state.unattended = params.enabled ?? true;
  await writeState(ctx.worktree, state);
  const status = state.unattended ? "开启" : "关闭";
  return `无人值守模式已 **${status}**。启用后系统将自动处理决策点，不再 question 用户。`;
}

// src/core/tools/submit.ts
var loadTaskWorkflow = (state) => loadWorkflowFile(resolveWorkflowPath(state));
function normalizeIssueId(id) {
  return String(id).trim().replace(/^#/, "");
}
function isSupplementOnly(params) {
  const hasAdjudication = (params.recheck_adjudications?.length ?? 0) > 0 || (params.exempt_adjudications?.length ?? 0) > 0;
  if (!hasAdjudication)
    return false;
  return (params.fixed_issue_ids?.length ?? 0) === 0 && (params.exempt_issue_ids?.length ?? 0) === 0 && (params.new_children?.length ?? 0) === 0 && (params.verified_tasks?.length ?? 0) === 0 && (params.failed_tasks?.length ?? 0) === 0 && !params.boundary_expansion && (params.must_do_checks?.length ?? 0) === 0;
}
function isTaskVerificationSupplement(params) {
  if ((params.verified_tasks?.length ?? 0) === 0)
    return false;
  return (params.failed_tasks?.length ?? 0) === 0 && (params.new_children?.length ?? 0) === 0 && (params.fixed_issue_ids?.length ?? 0) === 0 && (params.exempt_issue_ids?.length ?? 0) === 0 && (params.exempt_adjudications?.length ?? 0) === 0 && (params.recheck_adjudications?.length ?? 0) === 0 && !params.boundary_expansion && (params.must_do_checks?.length ?? 0) === 0;
}
function isTaskVerifySupplementAllowed(item, params, stepId, agent) {
  return isTaskVerificationSupplement(params) && getStepVerdict(item, stepId, agent) === "passed" && taskChildrenOf(item).some((c) => c.phase === "review");
}
function assertRejectedAdjudicationNotPassed(params) {
  if (params.verdict !== "passed")
    return;
  const rejectedExempt = params.exempt_adjudications?.find((adj) => adj.action === "rejected");
  if (rejectedExempt) {
    throw new Error(`豁免裁定失败：issue "${rejectedExempt.issue_id}" 被驳回（rejected），该 issue 需修复，verdict 必须为 failed，不能以 passed 提交。`);
  }
  const rejectedRecheck = params.recheck_adjudications?.find((adj) => adj.verdict === "rejected");
  if (rejectedRecheck) {
    throw new Error(`复核失败：issue "${rejectedRecheck.issue_id}" 被驳回（rejected），该 issue 需修复，verdict 必须为 failed，不能以 passed 提交。`);
  }
}
function resolveChildByIssueId(item, issueId) {
  const match = (c) => c.externalId === issueId || c.id === issueId || c.id === `issue:${issueId}`;
  return issueChildrenOf(item).find(match) ?? taskChildrenOf(item).find(match) ?? null;
}
function resolveTaskWorkItem(state) {
  const taskId = `task:${state.taskGroupId}`;
  const item = state.workItems.find((w) => w.id === taskId);
  if (!item) {
    throw new Error(`工作项 "${taskId}" 缺失，请重新调用 opx_orch_init 初始化。`);
  }
  return item;
}
var SUBMIT_OK_MESSAGE = "提交成功，请直接结束当前会话";
function itemBlockers(item) {
  return Array.isArray(item.metadata["blockers"]) ? item.metadata["blockers"] : [];
}
function addItemBlockers(item, raw) {
  const list = itemBlockers(item);
  let nextId = list.reduce((max, b) => Math.max(max, Number(b.id.replace(/^b/, "")) || 0), 0) + 1;
  for (const b of raw) {
    list.push({
      id: `b${nextId++}`,
      sourceRole: b.source_role,
      taskId: b.task_id ?? null,
      category: b.category,
      description: b.description,
      evidence: b.evidence,
      attemptedActions: b.attempted_actions,
      options: b.options ?? [],
      status: "awaiting_user",
      userResponse: null,
      architectConclusion: null
    });
  }
  item.metadata["blockers"] = list;
}
function collectFixedExemptLayers(item, fixedIds, exemptIds) {
  const fixedSourcePhases = new Set;
  const exemptSourcePhases = new Set;
  const touchedQualityDims = new Set;
  const touchQualityDim = (child) => {
    const f = resolveChildIssueFields(child);
    const declaredDim = REVIEW_DIMENSIONS.includes(child.metadata["dimension"]) ? child.metadata["dimension"] : undefined;
    if (f.sourcePhase === "quality" || declaredDim)
      touchedQualityDims.add(declaredDim ?? f.dimension);
    if (!declaredDim && f.sourcePhase === "quality") {
      const source = readIssueSource(child) ?? "";
      const sourceDim = agentToReviewDimension(source);
      if (sourceDim)
        touchedQualityDims.add(sourceDim);
    }
  };
  for (const id of fixedIds) {
    const child = resolveChildByIssueId(item, id);
    if (!child)
      continue;
    fixedSourcePhases.add(resolveChildIssueFields(child).sourcePhase);
    touchQualityDim(child);
  }
  for (const id of exemptIds) {
    const child = resolveChildByIssueId(item, id);
    if (!child)
      continue;
    exemptSourcePhases.add(resolveChildIssueFields(child).sourcePhase);
  }
  return {
    fixedSourcePhases: [...fixedSourcePhases],
    exemptSourcePhases: [...exemptSourcePhases],
    touchedQualityDims: [...touchedQualityDims]
  };
}
function buildIssueChild(nc, sourceAgent) {
  const child = createInitialWorkItem({
    id: nc.id,
    source: sourceAgent,
    externalId: nc.id,
    type: "issue",
    title: nc.title,
    description: nc.description,
    severity: nc.severity
  });
  child.metadata["source"] = sourceAgent;
  const sourceDim = agentToReviewDimension(sourceAgent);
  child.metadata["dimension"] = sourceDim ?? nc.dimension;
  if (nc.file)
    child.metadata["file"] = nc.file;
  if (nc.line !== undefined)
    child.metadata["line"] = nc.line;
  if (nc.suggestion)
    child.metadata["suggestion"] = nc.suggestion;
  if (nc.rule)
    child.metadata["rule"] = nc.rule;
  if (nc.root_cause_guess)
    child.metadata["root_cause_guess"] = nc.root_cause_guess;
  return child;
}
function clearReviewVerificationTags(item) {
  clearStepTags(item, "verify_tool");
  clearStepTags(item, "verify_task");
  clearStepTags(item, "verify_quality");
}
function resetTasksForBlocker(item) {
  for (const child of taskChildrenOf(item)) {
    if (child.phase === "done")
      continue;
    child.phase = "todo";
    delete child.metadata["reject_reason"];
  }
  clearReviewVerificationTags(item);
}
function assertBlockerUpdatable(blocker) {
  const raw = blocker;
  if (raw.status === undefined)
    raw.status = "awaiting_user";
  if (raw.status !== "awaiting_user") {
    throw new Error(`blocker "${blocker.id}" 状态不是 awaiting_user，无法更新。`);
  }
}
function handleAnalyzeParams(item, params) {
  if (params.execution_boundary) {
    item.metadata["execution_boundary"] = params.execution_boundary;
  }
  if (params.blockers?.length)
    addItemBlockers(item, params.blockers);
  if (params.blocker_updates?.length) {
    for (const u of params.blocker_updates) {
      const blocker = itemBlockers(item).find((b) => b.id === u.blocker_id);
      if (!blocker)
        throw new Error(`blocker "${u.blocker_id}" 不存在于 metadata.blockers 中。`);
      assertBlockerUpdatable(blocker);
      blocker.userResponse = u.user_response;
      blocker.status = "resolved";
    }
  }
  if (params.verdict === "passed" && itemBlockers(item).some((b) => b.status !== "resolved")) {
    throw new Error("存在未解决的 blocker，无法以 passed 提交 analyze step。请先通过 blocker_updates 处理全部 blocker。");
  }
}
function assertSimpleModeNoBlockerParams(params) {
  if (!params.blocker && !params.blockers?.length)
    return;
  throw new Error(`simple 模式不走 blocker 状态机：implement 提交不接受 blocker / blockers 参数。
` + `simple 流程没有 analyze 回退步骤，blocker 进入待裁决后没有裁决落点，后续 implement passed 会被未解决的 blocker 永久拦截。
` + `遇阻塞时，应当场用 question 向用户确认（无人值守时按准则自行裁决），并把处理方式与结论写进 must_do_checks 对应项的 evidence；
` + "需要架构裁决者裁决的场景请改用 full 模式（full 模式 blocker 会回退 analyze 裁决）。");
}
function handleImplementParams(item, params, mustDoContext) {
  if (params.blocker) {
    if (params.blocker_updates?.length) {
      throw new Error(`不可在同一轮提交中同时上报新 blocker（blocker 参数）与更新旧 blocker（blocker_updates）。
` + "请分两轮处理：先以 verdict=failed + blocker 上报新阻塞；用户确认后，下一轮再携带 blocker_updates 记录答复并重新提交。");
    }
    if (params.verdict !== "failed") {
      throw new Error("blocker 参数仅支持 verdict=failed 提交（on_fail 回退 analyze）。");
    }
    addItemBlockers(item, [params.blocker]);
    resetTasksForBlocker(item);
    return;
  }
  if (params.blocker_updates?.length) {
    for (const u of params.blocker_updates) {
      const blocker = itemBlockers(item).find((b) => b.id === u.blocker_id);
      if (!blocker)
        throw new Error(`blocker "${u.blocker_id}" 不存在于 metadata.blockers 中。`);
      assertBlockerUpdatable(blocker);
      blocker.userResponse = u.user_response;
      blocker.status = "resolved";
    }
  }
  if (params.verdict === "passed" && itemBlockers(item).some((b) => b.status !== "resolved")) {
    throw new Error("存在未解决的 blocker，无法以 passed 提交 implement step。请先通过 blocker_updates 处理全部 blocker。");
  }
  const tasks = taskListOf(item);
  const completed = normalizeTaskChildIds(params.completed_task_ids ?? [], item);
  const validIds = new Set(tasks.map((t) => t.id));
  for (const id of completed) {
    if (!validIds.has(id)) {
      throw new Error(`completed_task_ids 中包含无效 task id: "${id}"。
有效 task ID: ${Array.from(validIds).sort((a, b) => Number(a) - Number(b)).join(", ")}`);
    }
  }
  for (const id of completed) {
    const child = taskChildById(item, id);
    if (child && child.phase === "todo") {
      child.phase = "review";
      delete child.metadata["reject_reason"];
    }
  }
  const remaining = taskListOf(item).filter((t) => t.status === "open" || t.status === "rejected");
  if (remaining.length > 0) {
    throw new Error(`以下 task 处于 open/rejected 状态且未在 completed_task_ids 中：
` + remaining.map((t) => `- #${t.id}(${t.status}) ${t.title}`).join(`
`) + `
completed_task_ids 仅申报已完成可供验证的任务；无法完成或人工执行的任务不得虚报，` + `应以 verdict=failed + blocker 上报（task_id 指向该任务），经用户确认后凭 blocker 留痕重新申报。`);
  }
  if (params.verdict === "passed" && mustDoContext) {
    assertMustDoCoverage(mustDoContext.requiredItems, params.must_do_checks);
  } else if (params.must_do_checks) {
    assertMustDoCoverage([], params.must_do_checks);
  }
  if (params.must_do_checks) {
    archiveMustDoChecks(item, "implement", params.must_do_checks);
  }
  if (params.deployment_notes?.length) {
    item.metadata["deployment_notes"] = params.deployment_notes.filter((n) => n.trim() !== "");
  }
}
function archiveMustDoChecks(item, stepId, checks) {
  const raw = item.metadata["must_do_checks_by_step"];
  const byStep = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? raw : {};
  byStep[stepId] = checks;
  item.metadata["must_do_checks_by_step"] = byStep;
}
async function assertImplementNoChangeFact(item, params, wtPath) {
  if (params.verdict !== "passed")
    return;
  if (!hasNoChangeDeclaration(params.must_do_checks))
    return;
  const baseRef = typeof item.metadata["base_ref"] === "string" ? item.metadata["base_ref"] : null;
  if (!baseRef) {
    throw new Error(`implement 提交声明了 no_change（本轮无代码/配置变更）整体豁免，但当前无法界定变更区间（缺少 base_ref），豁免理由无法核对。
` + "请按必做清单逐项执行并申报结果；确属无变更的轮次也须逐项附执行证据（如构建/格式检查的空跑输出）。");
  }
  const changes = await detectChanges(wtPath, { baseRef });
  const nonDoc = changes.files.filter((f) => !isDocLikePath(f));
  if (nonDoc.length > 0) {
    throw new Error("implement 提交的 no_change 豁免被拒绝：no_change 仅适用于本轮确无代码/配置变更的情形，" + "且须经变更检测核对成立；检测结果显示本轮存在代码/配置变更。" + `
检出非文档类改动文件：
${nonDoc.map((f) => `  - ${f}`).join(`
`)}` + `
请按本 step 必做清单逐项执行并附证据申报；确无法执行的必做项以 completed=false + 结构化 skip_reason 申报降级理由。`);
  }
  if (changes.files.length === 0 && changes.hasNonDocChange) {
    throw new Error("implement 提交的 no_change 豁免被拒绝：变更检测未能产出可核对的文件清单（git 查询失败），" + "无法确认「无代码/配置变更」，豁免理由无法核对。" + `
请按本 step 必做清单逐项执行并附证据申报；确属无变更的轮次也须逐项附执行证据（如构建/格式检查的空跑输出）。`);
  }
}
function mergeBoundaryInto(item, expansion) {
  const boundary = item.metadata["execution_boundary"];
  if (!boundary)
    return;
  for (const dir of expansion.allowed_directories ?? []) {
    if (!boundary.allowed_directories.includes(dir))
      boundary.allowed_directories.push(dir);
  }
  for (const pkg of expansion.allowed_packages ?? []) {
    if (!boundary.allowed_packages.includes(pkg))
      boundary.allowed_packages.push(pkg);
  }
}
function assertFailedHasReason(item, params, newChildren, stepId, agent) {
  const hasNewBlocking = newChildren.some((c) => isBlockingSeverity(c.severity));
  const existingBlocking = item.children.filter((c) => !isTerminalPhase(c.phase) && isBlockingSeverity(c.severity));
  let layerName;
  let hasReason;
  if (stepId === "verify_task") {
    layerName = "任务层";
    hasReason = (params.failed_tasks?.length ?? 0) > 0 || hasNewBlocking || existingBlocking.some((c) => resolveChildIssueFields(c).sourcePhase === "task");
  } else if (stepId === "verify_tool") {
    layerName = "工具层";
    hasReason = hasNewBlocking || existingBlocking.some((c) => resolveChildIssueFields(c).sourcePhase === "tool");
  } else if (stepId === "verify_cleanup") {
    layerName = "收尾层";
    hasReason = hasNewBlocking || existingBlocking.length > 0;
  } else if (stepId === "quality_review") {
    layerName = "AI 审查层";
    hasReason = (params.failed_tasks?.length ?? 0) > 0 || hasNewBlocking || existingBlocking.some((c) => resolveChildIssueFields(c).sourcePhase === "quality");
  } else {
    const dimension = agentToReviewDimension(agent);
    layerName = dimension ? `AI 审查层(${dimension})` : "AI 审查层";
    const dimMatches = (c) => resolveChildIssueFields(c).dimension === dimension;
    hasReason = newChildren.some((c) => isBlockingSeverity(c.severity) && dimMatches(c)) || existingBlocking.some((c) => resolveChildIssueFields(c).sourcePhase === "quality" && dimMatches(c));
  }
  if (!hasReason) {
    throw new Error(`${layerName} 审核声称 passed=false，但不存在未解决的阻塞 issue。passed=false 时必须提供至少一个 Low+ issue 或 failed_task_id 作为不通过理由。`);
  }
}
function handleReviewParams(item, params, newChildren, stepId, opts) {
  if (params.verdict === "passed" && newChildren.some((c) => isBlockingSeverity(c.severity))) {
    throw new Error("review step 声称 passed=true，但 new_children 中包含 Low 及以上级别 issue。passed=true 只能带 Info 新报；有 Low+ issue 时必须设 verdict=failed。");
  }
  if (params.boundary_expansion) {
    if (params.verdict === "passed") {
      throw new Error("passed=true 时不允许边界扩展。boundary_expansion 仅 verdict=failed 有效。");
    }
    mergeBoundaryInto(item, params.boundary_expansion);
  }
  if (params.must_do_checks) {
    archiveMustDoChecks(item, stepId, params.must_do_checks);
  }
  if (params.verdict === "passed" && !opts.skipMustDoGate) {
    assertMustDoCoverage(resolveStepMustDo(opts.step, opts.session), params.must_do_checks);
  } else if (params.must_do_checks) {
    assertMustDoCoverage([], params.must_do_checks);
  }
  const isTaskVerifyStep = stepId === "verify_task" || stepId === "quality_review";
  if (params.verified_tasks?.length || params.failed_tasks?.length || params.verdict === "passed" && isTaskVerifyStep) {
    const tasks = taskListOf(item);
    const validIds = new Set(tasks.map((t) => t.id));
    const verified = normalizeTaskChildIds(params.verified_tasks ?? [], item);
    const failed = (params.failed_tasks ?? []).map((f) => ({
      task_id: normalizeTaskChildIds([f.task_id], item)[0],
      reason: f.reason
    }));
    for (const id of [...verified, ...failed.map((f) => f.task_id)]) {
      if (!validIds.has(id)) {
        throw new Error(`非法 task id: "${id}"。
合法 id：${Array.from(validIds).join(", ")}。`);
      }
    }
    if (params.verdict === "passed" && failed.length > 0) {
      throw new Error("passed=true 时不允许提供 failed_tasks；有任务未通过必须设 verdict=failed。");
    }
    const submitted = tasks.filter((t) => t.status === "submitted");
    const covered = new Set([...verified, ...failed.map((f) => f.task_id)]);
    const uncovered = submitted.filter((t) => !covered.has(t.id));
    if (uncovered.length > 0) {
      throw new Error(`以下 submitted task 未被 verified_tasks 或 failed_tasks 覆盖：
` + uncovered.map((t) => `- #${t.id} ${t.title}`).join(`
`) + `
verified_tasks 用于逐项确认已完成的任务；验证未通过的任务须以 failed_tasks 逐项驳回并设 verdict=failed 回退；` + `人工执行或环境不可验证的任务不得虚报确认，应以 verdict=failed + failed_tasks 驳回，` + `由开发者经 verdict=failed + blocker（task_id 指向该任务）上报、用户确认留痕后凭记录重新申报完成。`);
    }
    for (const id of verified) {
      const child = taskChildById(item, id);
      if (child && child.phase === "review") {
        child.phase = "done";
        delete child.metadata["reject_reason"];
      }
    }
    for (const f of failed) {
      const child = taskChildById(item, f.task_id);
      if (child && child.phase === "review") {
        child.phase = "todo";
        child.metadata["reject_reason"] = f.reason;
      }
    }
  }
}
async function agentSubmitExecute(params, ctx) {
  const lockPath = await getLockPath(ctx.worktree, params.change_id);
  await acquireLock(lockPath);
  try {
    const state = await readStateByWorktree(ctx.worktree, params.change_id);
    if (!state)
      throw new Error("编排会话未初始化。请先调用 opx_orch_init。");
    const workflow = loadTaskWorkflow(state);
    const item = resolveTaskWorkItem(state);
    if (params.checkpoint_decision) {
      return applyCheckpointDecision(params, item, workflow, ctx, state);
    }
    const wtPath = typeof item.metadata["worktree_path"] === "string" ? item.metadata["worktree_path"] : undefined;
    if (!wtPath) {
      throw new Error(`worktree 未就绪，当前拒绝提交。
请编排者先调用 opx_orch_set_worktree 确保 worktree 就绪后再提交。`);
    }
    const normalized = { ...params };
    if (normalized.fixed_issue_ids)
      normalized.fixed_issue_ids = normalized.fixed_issue_ids.map(normalizeIssueId);
    if (normalized.exempt_issue_ids)
      normalized.exempt_issue_ids = normalized.exempt_issue_ids.map(normalizeIssueId);
    if (normalized.exempt_adjudications) {
      normalized.exempt_adjudications = normalized.exempt_adjudications.map((adj) => ({
        ...adj,
        issue_id: normalizeIssueId(adj.issue_id)
      }));
    }
    if (normalized.recheck_adjudications) {
      normalized.recheck_adjudications = normalized.recheck_adjudications.map((adj) => ({
        ...adj,
        issue_id: normalizeIssueId(adj.issue_id)
      }));
    }
    params = normalized;
    const knownChildIds = new Set;
    for (const c of item.children) {
      knownChildIds.add(c.id);
      if (c.externalId)
        knownChildIds.add(c.externalId);
    }
    const availableIssueIds = () => [...knownChildIds].sort().join(", ");
    for (const id of params.fixed_issue_ids ?? []) {
      if (!resolveChildByIssueId(item, id)) {
        throw new Error(`fixed_issue_ids 中包含无效 issue id: "${id}"。
可用 issue ID: ${availableIssueIds()}`);
      }
    }
    for (const id of params.exempt_issue_ids ?? []) {
      const child = resolveChildByIssueId(item, id);
      if (!child) {
        throw new Error(`exempt_issue_ids 中包含无效 issue id: "${id}"。
可用 issue ID: ${availableIssueIds()}`);
      }
      if (isInfoSeverity(child.severity)) {
        throw new Error(`豁免申请失败：issue "${child.id}" 为 Info 级 issue，不阻塞提交，无需申请豁免。`);
      }
    }
    for (const id of params.recheck_adjudications?.map((a) => a.issue_id) ?? []) {
      if (!resolveChildByIssueId(item, id)) {
        throw new Error(`recheck_adjudications 中包含无效 issue id: "${id}"。
可用 issue ID: ${availableIssueIds()}`);
      }
    }
    const guardStepPhase = workflow.stepMap.get(params.step_id)?.phase.name;
    if (guardStepPhase === "review" && getStepVerdict(item, params.step_id, ctx.agent) === "passed" && !isSupplementOnly(params) && !isTaskVerifySupplementAllowed(item, params, params.step_id, ctx.agent)) {
      throw new Error(`重复提交守卫：agent "${ctx.agent}" 已在 step "${params.step_id}" 以 passed 通过，不允许重复提交。`);
    }
    assertRejectedAdjudicationNotPassed(params);
    const pendingExemptions = [];
    for (const adj of params.exempt_adjudications ?? []) {
      const child = resolveChildByIssueId(item, adj.issue_id);
      if (!child) {
        throw new Error(`豁免裁定失败：issue "${adj.issue_id}" 不存在于 item "${item.id}" 的 children 中。`);
      }
      adjudicateExempt(item, workflow, { issueId: child.id, agentKey: ctx.agent, action: adj.action });
      if (adj.action === "dismissed") {
        pendingExemptions.push(child);
      }
    }
    for (const adj of params.recheck_adjudications ?? []) {
      const child = resolveChildByIssueId(item, adj.issue_id);
      if (!child) {
        throw new Error(`复核失败：issue "${adj.issue_id}" 不存在于 item "${item.id}" 的 children 中。`);
      }
      adjudicateRecheck(item, workflow, {
        issueId: child.id,
        agentKey: ctx.agent,
        verdict: adj.verdict,
        rejectReason: adj.reject_reason
      });
    }
    assertSubmitRouting(workflow, item, params.step_id, ctx.agent);
    const stepPhase = workflow.stepMap.get(params.step_id).phase.name;
    if ((params.new_children?.length ?? 0) > 0 && stepPhase !== "review") {
      throw new Error(`仅 review 阶段的 step 允许提报新 issue（new_children），当前 step "${params.step_id}" 属于 "${stepPhase}" 阶段，拒绝提报。`);
    }
    if (stepPhase === "review" && (params.new_children?.length ?? 0) > 0) {
      assertIssueFilesWithin(params.new_children, wtPath ?? ctx.worktree);
    }
    const sourceDim = agentToReviewDimension(ctx.agent);
    for (const nc of params.new_children ?? []) {
      if (!nc.id || !nc.id.trim()) {
        throw new Error("new_children 中的 issue id 不能为空，请为每个新 issue 指定唯一 id。");
      }
      if (!nc.title || !nc.title.trim()) {
        throw new Error(`new_children 中 issue "${nc.id}" 的 title 不能为空。`);
      }
      if (!nc.description || !nc.description.trim()) {
        throw new Error(`new_children 中 issue "${nc.id}" 的 description 不能为空。`);
      }
      if (sourceDim) {
        if (nc.dimension !== undefined) {
          if (!REVIEW_DIMENSIONS.includes(nc.dimension)) {
            throw new Error(`new_children 中 issue "${nc.id}" 的 dimension 非法："${nc.dimension}"。合法维度：${REVIEW_DIMENSIONS.join(", ")}。`);
          }
          if (nc.dimension !== sourceDim) {
            throw new Error(`new_children 中 issue "${nc.id}" 显式声明的 dimension "${nc.dimension}" 与报源维度 "${sourceDim}" 不一致。quality reviewer 报 issue 的维度由报源推断，显式填写时必须与报源维度一致。`);
          }
        }
      } else {
        if (nc.dimension === undefined) {
          throw new Error(`new_children 中 issue "${nc.id}" 未声明归因维度 dimension。tool/task reviewer 报 issue 必须显式声明 dimension（归因维度），合法值：${REVIEW_DIMENSIONS.join(", ")}。`);
        }
        if (!REVIEW_DIMENSIONS.includes(nc.dimension)) {
          throw new Error(`new_children 中 issue "${nc.id}" 的 dimension 非法："${nc.dimension}"。合法维度：${REVIEW_DIMENSIONS.join(", ")}。`);
        }
      }
    }
    const newChildren = (params.new_children ?? []).map((nc) => buildIssueChild(nc, ctx.agent));
    if (stepPhase === "review") {
      if (isReviewerFamily(ctx.agent)) {
        const dirtyNonDoc = await listDirtyNonDocFiles(wtPath);
        if (dirtyNonDoc.length > 0) {
          const fileLines = dirtyNonDoc.map((f) => `  - ${f}`).join(`
`);
          throw new Error(`提交被拒绝：工作区存在未提交的代码类改动，工具不允许这类改动随审查提交。
` + `常见来源有两种：① 反向探针改坏的实现未还原；② 审查过程中临时修改的代码未清理。
` + `这两种都必须先还原，不得以 commit 方式提交掉。
` + `涉及文件：
${fileLines}
` + `请先还原或清理，再重新提交：
` + `  - 已跟踪文件的改动：git checkout -- <文件> 还原
` + `  - 新增的临时文件：直接删除
` + `允许提交的范围只有注释修正与文档类：
` + `  - 文档类（openspec/ 下文件与 .md 文件）：提交时自动 commit，无需手工处理。
` + `  - 源码内的注释修正：可以先 commit，但该提交必须只含注释改动，不得夹带任何逻辑改动或探针改动。
` + `代码类改动不在此列：不要把探针改动或临时改动 commit 掉来绕过本检查；审查者不应修改代码逻辑，发现问题请报 issue。`);
        }
      }
      const stepCfg = workflow.stepMap.get(params.step_id).step;
      handleReviewParams(item, params, newChildren, params.step_id, {
        step: stepCfg,
        session: state.stacks ?? null,
        skipMustDoGate: isSupplementOnly(params) || isTaskVerifySupplementAllowed(item, params, params.step_id, ctx.agent)
      });
    } else if (stepPhase === "todo") {
      handleAnalyzeParams(item, params);
    } else if (stepPhase === "in_progress") {
      if (state.mode === "simple" && params.step_id === "implement") {
        assertSimpleModeNoBlockerParams(params);
      }
      if (params.step_id === "implement" && (state.mode === "simple" || params.verdict === "passed")) {
        const clean = await isWorktreeClean(wtPath);
        if (!clean) {
          throw new Error(state.mode === "simple" ? `simple 模式 implement 提交被拒绝：工作区存在未提交内容。
请先 git commit 提交全部变更后再提交 implement。` : `full 模式 implement 提交被拒绝：工作区存在未提交内容。
请先 git commit 后再提交 implement。`);
        }
      }
      const implStep = workflow.stepMap.get(params.step_id).step;
      await assertImplementNoChangeFact(item, params, wtPath);
      handleImplementParams(item, params, {
        requiredItems: resolveStepMustDo(implStep, state.stacks ?? null)
      });
    }
    const { accepted } = dedupeNewChildren(item, newChildren);
    if (stepPhase === "review" && accepted.length > 0) {
      const store = await readExemptions(ctx.worktree);
      applyExemptionDowngrade(accepted, store);
    }
    if (stepPhase === "review" && params.verdict === "failed") {
      assertFailedHasReason(item, params, accepted, params.step_id, ctx.agent);
    }
    if (stepPhase === "in_progress" && (params.fixed_issue_ids?.length || params.exempt_issue_ids?.length)) {
      resetReviewTagsOnFix(item, collectFixedExemptLayers(item, params.fixed_issue_ids ?? [], params.exempt_issue_ids ?? []));
    }
    submitForStep(item, workflow, {
      stepId: params.step_id,
      agentKey: ctx.agent,
      verdict: params.verdict,
      fixedIds: params.fixed_issue_ids,
      exemptIds: params.exempt_issue_ids,
      newChildren: accepted
    });
    const autoCommitLines = [];
    if (isReviewerFamily(ctx.agent)) {
      const ac = await autoCommitWorktreeChanges(wtPath, ctx.agent, params.step_id);
      if (ac.status === "committed") {
        autoCommitLines.push(`- ✅ worktree 直改修正已自动提交（${ac.files.length} 个文件，commit message: \`docs(opx): direct fixes by ${ctx.agent} (${params.step_id})\`）`);
      } else if (ac.status === "failed") {
        autoCommitLines.push(`- ⚠️ worktree 直改修正自动提交失败：${ac.stderr || "未知错误"}。请编排者安排补提交（在 worktree 内手工 add 并 commit：已跟踪改动用 git add -u，未跟踪文档用 git add -- <文件>）`);
      }
      if (ac.untrackedFiles.length > 0) {
        autoCommitLines.push(`- ⚠️ 存在未跟踪的非文档类文件未纳入自动提交（文档类已自动提交；这些须由编排者/开发者自行处理）：${ac.untrackedFiles.join("、")}`);
      }
    }
    if (stepPhase === "in_progress" && params.step_id === "implement" && params.verdict === "passed" && wtPath && typeof item.metadata["branch_name"] === "string" && item.metadata["_main_pollution_reconciled"] !== true) {
      const baseRef = typeof item.metadata["base_ref"] === "string" ? item.metadata["base_ref"] : null;
      await reconcileMainPollution(ctx.worktree, wtPath, {
        changeId: state.changeId,
        baseRef
      });
      item.metadata["_main_pollution_reconciled"] = true;
    }
    if (params.step_id === "verify_tool" && agentToReviewLayer(ctx.agent) === "tool" || params.step_id === "quality_review" && ctx.agent === "openspec-reviewer") {
      const head = await getCurrentHead(wtPath);
      if (head)
        item.metadata["_tool_review_checkpoint"] = head;
    }
    for (const child of pendingExemptions) {
      await writeDismissedExemption(ctx.worktree, child, { changeId: state.changeId, exemptedBy: ctx.agent });
    }
    await writeState(ctx.worktree, state);
    if (autoCommitLines.length === 0)
      return SUBMIT_OK_MESSAGE;
    return [
      `## ✅ ${SUBMIT_OK_MESSAGE}`,
      "",
      "### worktree 自动提交",
      "",
      ...autoCommitLines,
      ""
    ].join(`
`);
  } finally {
    releaseLock(lockPath);
  }
}
async function applyCheckpointDecision(params, item, workflow, ctx, state) {
  const decision = params.checkpoint_decision;
  const stepId = item.currentStep;
  if (!stepId)
    throw new Error(`检查点决策失败：item "${item.id}" 无 currentStep，无法定位当前检查点 step。`);
  const entry = workflow.stepMap.get(stepId);
  if (!entry)
    throw new Error(`检查点决策失败：当前 step "${stepId}" 未在 workflow 中声明。`);
  const step = entry.step;
  const atCheckpoint = item.metadata["_checkpoint"] === true || checkpointTriggered(item, workflow, step);
  if (!atCheckpoint)
    throw new Error(`检查点决策失败：当前不在检查点状态，无法执行 ${decision}。`);
  if (decision === "continue") {
    applyCheckpointContinue(item, step);
  } else {
    const prevChecks = mustDoChecksOfStep(item.metadata, stepId);
    const uncovered = uncoveredMustDo(step, prevChecks, state.stacks ?? null);
    if (uncovered.length > 0) {
      const provided = new Map;
      for (const r of params.checkpoint_skip_reasons ?? []) {
        if (isValidSkipData(r) && typeof r.item === "string")
          provided.set(r.item, r);
      }
      const missing = uncovered.filter((m) => !provided.has(m));
      if (missing.length > 0) {
        throw new Error(`giveup 无法应用：当前 step 的必做清单存在未覆盖项，须逐项提供结构化降级理由。
` + `缺少降级理由的必做项：${missing.join("、")}
` + `请通过 checkpoint_skip_reasons 逐项提供（giveup 未覆盖项不可跳过申报）：
` + `[${SKIP_REASON_FORMAT}]`);
      }
      item.metadata["_giveup_validation"] = params.checkpoint_skip_reasons;
    }
    applyCheckpointGiveup(item, step);
    item.metadata["_giveup"] = true;
    for (const blocker of itemBlockers(item)) {
      if (blocker.status !== "resolved") {
        blocker.status = "resolved";
        blocker.architectConclusion = "随放弃处理";
      }
    }
    const advance = applyTransition(item, workflow, "pass");
    if (advance.advanced) {
      delete item.metadata["_advance_block_reason"];
      chainPassAdvance(item, workflow, advance.target);
    } else {
      item.metadata["_advance_block_reason"] = advance.reason;
    }
  }
  await writeState(ctx.worktree, state);
  return renderCheckpointDecisionResult(decision, item, step);
}
function renderCheckpointDecisionResult(decision, item, step) {
  if (decision === "continue") {
    return [
      "## ✅ 检查点决策已应用：continue",
      "",
      `- **step**: \`${step.id}\` 的 agent 裁决已重置为 pending，可重新提交该 step。`,
      `- **当前 phase**: ${item.phase}`,
      ""
    ].join(`
`);
  }
  const cancelled = item.children.filter((c) => c.phase === "cancelled").map((c) => c.id);
  const blockReason = typeof item.metadata["_advance_block_reason"] === "string" ? item.metadata["_advance_block_reason"] : null;
  const lines = [
    "## ✅ 检查点决策已应用：giveup",
    "",
    `- **step**: \`${step.id}\` 已标记 completed（所有 agent 视为 passed）。`,
    `- **未解决 children**（${cancelled.length} 个）已置 cancelled：${cancelled.join("、") || "(无)"}`,
    `- **当前 phase**: ${item.phase}${item.currentStep ? `（step \`${item.currentStep}\`）` : ""}`
  ];
  if (blockReason) {
    lines.push(`- **⚠️ 推进被拦截**: ${blockReason}`);
    lines.push(`- 请用 \`opx_status\` 查看诊断，必要时 \`opx_orch_init(recovery=...)\` 恢复。`);
  }
  lines.push("");
  return lines.join(`
`);
}

// src/adapters/deepseek-harness/schema-dsl.ts
var UNSUPPORTED_CONSTRAINTS = [
  { key: "minLength", suffix: "（不得为空）" },
  { key: "minItems", suffix: "（至少含 1 项）" },
  { key: "minimum", suffix: "（不小于该值）" },
  { key: "maximum", suffix: "（不大于该值）" }
];
function describeWithDroppedConstraints(schema2) {
  const parts = [];
  if (typeof schema2.description === "string" && schema2.description !== "")
    parts.push(schema2.description);
  for (const { key, suffix } of UNSUPPORTED_CONSTRAINTS) {
    const value = schema2[key];
    if (typeof value === "number")
      parts.push(`${key}=${value}${suffix}`);
  }
  return parts.length > 0 ? parts.join(" ") : undefined;
}
function projectValueSchema(schema2) {
  const description = describeWithDroppedConstraints(schema2);
  const annotation = description !== undefined ? { description } : {};
  switch (schema2.type) {
    case "object": {
      const properties = projectProperties(schema2);
      return {
        type: "object",
        ...annotation,
        ...properties,
        additionalProperties: schema2.additionalProperties === true
      };
    }
    case "array":
      return {
        type: "array",
        ...annotation,
        items: schema2.items !== undefined ? projectValueSchema(schema2.items) : { type: "string" }
      };
    case "string":
    case "number":
    case "integer":
    case "boolean":
    case "null":
      return {
        type: schema2.type,
        ...annotation,
        ...Array.isArray(schema2.enum) ? { enum: [...schema2.enum] } : {},
        ...schema2.default !== undefined ? { default: schema2.default } : {}
      };
    default:
      return { type: "json", ...annotation };
  }
}
function projectProperties(schema2) {
  const source = schema2.properties ?? {};
  const required = new Set(schema2.required ?? []);
  const properties = {};
  for (const [key, sub] of Object.entries(source)) {
    const projected = projectValueSchema(sub);
    properties[key] = required.has(key) ? { ...projected, required: true } : projected;
  }
  return Object.keys(properties).length > 0 ? { properties } : {};
}
function jsonSchemaToToolParameters(schema2) {
  return projectProperties(schema2).properties ?? {};
}

// src/core/tools/schemas.ts
var executionBoundarySchema = {
  type: "object",
  description: "developer 的执行边界",
  properties: {
    allowed_directories: {
      type: "array",
      description: "developer 只能修改/创建文件的目录列表（含实施与验证所需的测试代码目录）",
      items: { type: "string", minLength: 1 },
      minItems: 1
    },
    allowed_packages: {
      type: "array",
      description: "developer 只能新增/修改代码的包路径列表（含对应的测试包路径）",
      items: { type: "string", minLength: 1 },
      minItems: 1
    },
    notes: {
      type: "string",
      description: "实施建议：关键坑位提醒、组件复用指引、设计约束边缘场景、框架应用说明（如对象映射框架使用要点）；不含目录/包路径（见 allowed_directories/allowed_packages），无则留空"
    }
  },
  required: ["allowed_directories", "allowed_packages", "notes"],
  additionalProperties: false
};
var boundaryExpansionSchema = {
  type: "object",
  description: "reviewer 声明的执行边界扩展",
  properties: {
    allowed_directories: {
      type: "array",
      description: "reviewer 声明的额外允许目录",
      items: { type: "string", minLength: 1 },
      minItems: 1
    },
    allowed_packages: {
      type: "array",
      description: "reviewer 声明的额外允许包路径",
      items: { type: "string", minLength: 1 },
      minItems: 1
    }
  },
  additionalProperties: false
};
var taskVerifyItem = {
  type: "object",
  description: "验证失败的子任务项",
  properties: {
    task_id: { type: "string", minLength: 1, description: "子任务 ID（task 清单中 task 项的 id）" },
    reason: { type: "string", minLength: 1, description: "失败理由" }
  },
  required: ["task_id", "reason"],
  additionalProperties: false
};
var mustDoCheckSchema = {
  type: "object",
  description: "本 step 必做项的单条申报结果（必做清单由 workflow step 声明，见视图「本 step 必做清单」区块）",
  properties: {
    step: {
      type: "string",
      minLength: 1,
      description: "必做项 id，对应视图「本 step 必做清单」区块的条目（首段 id 后可附冒号说明，如 `deep_scan: 核验申报`）"
    },
    completed: { type: "boolean", description: "是否完成" },
    evidence: {
      type: "string",
      description: "完成时必须提供：执行命令/方式 + 结果摘要（含关键输出指标），供审查者分级复验对照"
    },
    skip_reason: {
      type: "string",
      description: `未完成时必填：结构化降级理由 JSON，格式：${SKIP_REASON_FORMAT}；` + `adjudication 取值：user_response=用户答复 / unattended_auto=无人值守自动降级 / env_unavailable=环境不可用（须附尝试记录）`
    }
  },
  required: ["step", "completed"],
  additionalProperties: false
};
var blockerItem = {
  type: "object",
  description: "阻塞项",
  properties: {
    source_role: { type: "string", minLength: 1 },
    task_id: { type: "string", minLength: 1 },
    category: { type: "string", minLength: 1 },
    description: { type: "string", minLength: 1 },
    evidence: { type: "string", minLength: 1 },
    attempted_actions: { type: "string", minLength: 1 },
    options: { type: "array", items: { type: "string", minLength: 1 } }
  },
  required: ["source_role", "category", "description", "evidence", "attempted_actions"],
  additionalProperties: false
};
var exemptAdjudicationItem = {
  type: "object",
  description: "豁免申请裁定项",
  properties: {
    issue_id: { type: "string", minLength: 1, description: "申请豁免的 issue ID" },
    action: {
      type: "string",
      enum: ["dismissed", "rejected"],
      description: "dismissed=豁免成立（issue 置 cancelled）；rejected=驳回（issue 回 todo 继续修复）"
    }
  },
  required: ["issue_id", "action"],
  additionalProperties: false
};
var recheckAdjudicationItem = {
  type: "object",
  description: "待复核 issue 复核项",
  properties: {
    issue_id: { type: "string", minLength: 1, description: "已修复待复核（review 态）的 issue ID" },
    verdict: {
      type: "string",
      enum: ["passed", "rejected"],
      description: "passed=复核通过（issue 置 done）；rejected=复核驳回（issue 回 todo 继续修复）"
    },
    reject_reason: { type: "string", description: "复核驳回原因（verdict=rejected 必填，供 developer 修复参考）" }
  },
  required: ["issue_id", "verdict"],
  additionalProperties: false
};
var checkpointSkipReasonItem = {
  type: "object",
  description: "giveup 决策的必做项结构化降级理由",
  properties: {
    item: { type: "string", minLength: 1, description: "对应的必做项（workflow step 声明的必做清单项，见视图区块）" },
    category: { type: "string", minLength: 1, description: "降级类别，如环境不可用 / 用户裁定豁免 / 无人值守自动降级" },
    adjudication: {
      type: "string",
      enum: ["user_response", "unattended_auto", "env_unavailable"],
      description: "裁定方式：user_response=用户答复 / unattended_auto=无人值守自动降级 / env_unavailable=环境不可用（须附尝试记录）"
    },
    note: { type: "string", description: "降级说明" }
  },
  required: ["item", "category", "adjudication"],
  additionalProperties: false
};
var newChildIssueItem = {
  type: "object",
  description: "提交时新增的 issue child",
  properties: {
    id: { type: "string", minLength: 1, description: "新 issue 的唯一 id（不可为空）" },
    title: { type: "string", minLength: 1, description: "issue 标题（不可为空）" },
    description: { type: "string", minLength: 1, description: "issue 描述（不可为空，参与去重 key）" },
    severity: { type: "string", enum: SEVERITY_LEVELS },
    dimension: {
      type: "string",
      enum: CODE_DIMENSIONS,
      description: "issue 归因维度：quality reviewer 报 issue 时由报源自动推断、无需填写（显式填写须与报源维度一致）；tool/task reviewer 报 issue 时必须显式填写"
    },
    file: { type: "string", description: "问题所在文件路径（相对于 worktree）" },
    line: { type: "integer", minimum: 0, description: "问题所在行号（0=整文件/待新建文件）" },
    suggestion: { type: "string", description: "修复建议" },
    rule: { type: "string", description: "工具规则名（如 PMD Rule / SonarQube rule），无则省略" },
    root_cause_guess: { type: "string", description: "根因猜测（仅特定维度需要）" }
  },
  required: ["id", "title", "description"],
  additionalProperties: false
};
var recoverySchema = {
  type: "object",
  description: "进度恢复参数。提供后按 phase 恢复阶段状态，< phase 为 completed，== phase 为 in_progress，> phase 为 not_started。",
  properties: {
    phase: {
      type: "string",
      enum: ["task_analysis", "dev_impl", "review"],
      description: "恢复到哪个阶段。task_analysis 在 full 下等同 dev_impl（重置本组任务进度并从 implement 开始），仍用于重制任务组与模式切换窗口"
    },
    review_layer: {
      type: "string",
      enum: ["tool", "task", "quality"],
      description: "恢复到 review 内某子层（仅 phase=review 时有效）。tool→从 tool 层开始（默认），task→tool 层标记完成从 task 层开始，quality→tool+task 层完成从 quality 层开始。已通过（passed）的审查层标记在恢复时保留，恢复自动跳到第一个未全部通过的子层"
    },
    reopenIssues: {
      type: "boolean",
      default: false,
      description: "完成后继续修 issue：将目标任务组全部非 verified issue 置为 rejected，重置 review 进度，回到 dev_impl 阶段。目标组必须为 completed。与 review_layer 互斥。"
    },
    reset_steps: {
      type: "array",
      description: "重置指定审查 step 的通过标记为 pending（仅 phase=review 时有效，与 review_layer 互斥）。用于已 passed 但被本层遗漏复核/裁定/任务验证阻塞的 review step 强制重新审查；恢复后 currentStep 落在第一个未全部通过的审查 step，可能早于被重置的 step。值按模式生效：full 模式合法值为 verify_tool/verify_task/verify_quality，simple 模式合法值为 quality_review；传入不属于当前模式的值会在运行时报错。",
      items: { type: "string", enum: ["verify_tool", "verify_task", "verify_quality", "quality_review"] }
    }
  },
  required: ["phase"],
  additionalProperties: false
};
var orchInitSchema = {
  type: "object",
  properties: {
    change_id: { type: "string", minLength: 1, description: "OpenSpec 变更 ID（change 会话入口；与 review_scope 二选一）" },
    task_group_id: {
      type: "string",
      minLength: 1,
      description: "要初始化的任务组 ID（change 会话入口）。无 recovery 重复调用当前组时保留进度；切换任务组时仅初始化目标组。独立审查会话恢复时可不传。"
    },
    base_branch: {
      type: "string",
      description: "基准分支名（如 main、develop），作为 change 分支（change/{changeId}）的 fork 源与收口合并目标。须为已存在的本地分支（远端引用不支持）；未传则自动从当前 git 分支推导。基准分支在 init 时固化，重入传不同值会被拒绝；主仓库检出分支不需要切换。仅 change 会话入口有效。"
    },
    recovery: recoverySchema,
    project_stacks: {
      type: "array",
      description: "项目形态栈（必传，两入口均需）：每个值必须是当前 skill 索引中某个 skill frontmatter 声明的 stacks 标签（动态校验，无硬编码值域），否则拒绝执行。存入编排会话状态，作为 skill 加载清单过滤与 must_do 门禁的形态过滤基准。",
      items: { type: "string", minLength: 1 },
      minItems: 1
    },
    project_frameworks: {
      type: "array",
      description: "项目框架栈（必传，两入口均需）：每个值必须是当前 skill 索引中某个 skill frontmatter 声明的 frameworks 标签（动态校验，无硬编码值域），否则拒绝执行。存入编排会话状态，作为 skill 加载清单过滤与 must_do 门禁的框架过滤基准。",
      items: { type: "string", minLength: 1 },
      minItems: 1
    },
    mode: {
      type: "string",
      enum: ["full", "simple"],
      description: "流程模式选择（仅 change 会话入口有效，独立审查会话不使用）：full=完整流程（implement→三重审查+收尾验证）；simple=精简流程（implement→quality_review→done，verify_cleanup 仅作收口漂移/冲突回退落点，正常流转不经过，缺省）。首次新建编排状态时固化；已开始的变更仅在允许窗口内可更新：切换任务组（其他任务组均已完成或从未激活）或 recovery.phase=task_analysis 重制当前组（其他任务组同样须已完成或从未激活）；其余场景传不同 mode 将报错。"
    },
    review_scope: {
      type: "object",
      description: "独立审查会话入口（不绑定 OpenSpec change）：与 change_id/task_group_id 互斥——同传报错、都不传报错，两种入口二选一。会话 id 由审查范围确定性推导并在返回体回传，后续所有工具以 change_id 形式传入该会话 id。",
      properties: {
        scope_type: {
          type: "string",
          enum: ["pr", "full"],
          description: "审查范围：pr=按 base_ref..head_ref 本地分支区间审查；full=全量代码库审查"
        },
        base_ref: {
          type: "string",
          minLength: 1,
          description: "pr 形态的基准本地分支。缺省自动推导（优先 main、其次 master）。须为本地分支（origin/* 等远端 ref 不受支持——收尾合并只推进本地分支引用）"
        },
        head_ref: {
          type: "string",
          minLength: 1,
          description: "pr 形态的头部本地分支（审查目标分支，pr 必传）。须为本地分支（origin/* 等远端 ref 不受支持）"
        },
        granularity: {
          type: "string",
          enum: ["simple", "thorough"],
          description: "审查颗粒度：simple=单层合并审查；thorough=三层审查（工具检查→回归验证→五维度质量审查）"
        },
        fix: {
          type: "string",
          enum: ["none", "fix"],
          description: "修复策略：none=只审不修（issue 报告即交付物，审查失败直接收口出报告）；fix=审并修（审查失败回退修复，修复后重审）"
        }
      },
      required: ["scope_type", "granularity", "fix"],
      additionalProperties: false
    }
  },
  required: ["project_stacks", "project_frameworks"],
  additionalProperties: false
};
var setWorktreeSchema = {
  type: "object",
  properties: {
    change_id: { type: "string", minLength: 1, description: "change ID" },
    worktree_path: { type: "string", description: "git worktree 的绝对路径（可选，不传则按规范自动生成 .worktree/{changeId}/ws）" },
    branch_name: { type: "string", description: "worktree 对应的分支名（可选，不传则按 change 模型确定性派生：change/{changeId}，整个 change 串行复用同一分支与常驻 worktree）" }
  },
  required: ["change_id"],
  additionalProperties: false
};
var statusSchema = {
  type: "object",
  properties: {
    change_id: { type: "string", minLength: 1, description: "change ID" }
  },
  required: ["change_id"],
  additionalProperties: false
};
var completeTaskGroupSchema = {
  type: "object",
  properties: {
    change_id: { type: "string", minLength: 1, description: "change ID" }
  },
  required: ["change_id"],
  additionalProperties: false
};
var setUnattendedSchema = {
  type: "object",
  properties: {
    change_id: { type: "string", minLength: 1, description: "change ID" },
    enabled: { type: "boolean", default: true, description: "true=开启；false=关闭" }
  },
  required: ["change_id"],
  additionalProperties: false
};
var agentSubmitSchema = {
  type: "object",
  properties: {
    change_id: { type: "string", minLength: 1, description: "change ID" },
    step_id: { type: "string", minLength: 1, description: "workflow step 的 id" },
    verdict: { type: "string", enum: ["passed", "failed"], description: "裁决结果" },
    fixed_issue_ids: {
      type: "array",
      description: "声明已修复的 issue child id",
      items: { type: "string" }
    },
    exempt_issue_ids: {
      type: "array",
      description: "声明申请豁免的 issue child id",
      items: { type: "string" }
    },
    exempt_adjudications: {
      type: "array",
      description: "裁定的豁免申请列表：dismissed→cancelled，rejected→回 todo",
      items: exemptAdjudicationItem
    },
    recheck_adjudications: {
      type: "array",
      description: "复核已修复待复核（review 态）issue 的结论列表：passed→done，rejected→回 todo + refix_count 递增 + 写 reject_reason（谁提谁裁定）",
      items: recheckAdjudicationItem
    },
    checkpoint_decision: {
      type: "string",
      enum: ["continue", "giveup"],
      description: "重试检查点决策：continue=重置该 step tag 并回退 parent；giveup=未解决 children 强制 cancelled 并将 step 标记 completed"
    },
    checkpoint_skip_reasons: {
      type: "array",
      description: "giveup 决策配套：对当前 step 必做清单未覆盖项的结构化降级理由（未覆盖项缺理由则拒绝 giveup）",
      items: checkpointSkipReasonItem
    },
    new_children: {
      type: "array",
      description: "提交时新增的 issue child",
      items: newChildIssueItem
    },
    execution_boundary: {
      ...executionBoundarySchema,
      description: "analyze 回退（blocker 裁决）时的执行边界修订（可选）"
    },
    blockers: { type: "array", description: "analyze step：新增 blocker 列表", items: blockerItem },
    blocker_updates: {
      type: "array",
      description: "analyze / implement step：按 blocker_id 置 resolved 并记录用户答复（implement 下人工执行任务凭留痕重新申报的依据）",
      items: {
        type: "object",
        properties: {
          blocker_id: { type: "string", minLength: 1, description: "blocker ID" },
          user_response: { type: "string", minLength: 1, description: "用户答复" }
        },
        required: ["blocker_id", "user_response"],
        additionalProperties: false
      }
    },
    blocker: {
      ...blockerItem,
      description: "implement step：outcome=blocked 等价，须配合 verdict=failed"
    },
    deployment_notes: {
      type: "array",
      description: "implement step：规划文档未记载、实施时新发现的部署注意点（数据/结构变更脚本执行、中间件配置调整、新增配置项或功能开关、外部接口契约变化、依赖清单/构建配置变更）；无则省略",
      items: { type: "string", minLength: 1 }
    },
    completed_task_ids: {
      type: "array",
      description: "implement step：已完成的 task id（覆盖门禁：全部 open/rejected task 必须被覆盖）",
      items: { type: "string" }
    },
    must_do_checks: {
      type: "array",
      description: "本 step 必做项申报（implement / review step 通用）：按视图「本 step 必做清单」区块的生效清单逐项申报，passed 提交时遗漏必做项会被门禁拒绝",
      items: mustDoCheckSchema
    },
    boundary_expansion: {
      ...boundaryExpansionSchema,
      description: "review step：执行边界扩展（仅 verdict=failed 有效）"
    },
    verified_tasks: {
      type: "array",
      description: "verify_task / quality_review step（任务验证归属层）：逐项确认验证通过的 task id；passed 提交时 submitted task 必须被 verified_tasks/failed_tasks 全覆盖（工具强制门禁），漏带会被拒绝",
      items: { type: "string" }
    },
    failed_tasks: {
      type: "array",
      description: "verify_task / quality_review step：验证失败的 task 列表（含原因）",
      items: taskVerifyItem
    }
  },
  required: ["change_id", "step_id", "verdict"],
  additionalProperties: false
};

// src/adapters/tool-specs.ts
var OPX_TOOL_SPECS = [
  {
    name: "opx_orch_init",
    description: "初始化编排会话。project_stacks 与 project_frameworks 必传（change 入口与 review_scope 独立审查入口均需要）：声明项目形态栈与框架栈，每个值须命中当前 skill 索引中 skill frontmatter 声明的 stacks / frameworks 标签（动态校验，无硬编码值域），作为 skill 加载清单过滤与 step 必做清单分组的过滤基准，与 change_id 同生命周期持久化（recovery 恢复时同样必传）。传入变更 ID 和任务组 ID，工具自动解析 tasks.md 提取全部任务组并解析目标组子任务，同时自动从 clarify.md 解析当前任务组执行边界写入状态，缺失时按整个 worktree 处理。可通过 recovery 参数恢复到指定阶段。无 recovery 重复初始化当前任务组时保留其阶段和进度；切换到其它任务组时初始化该组。可选 mode 参数（full/simple，缺省 simple）选择流程模式：full=完整流程（implement→三重审查+收尾验证，analyze 仅作 implement 上报 blocker 后的裁决回退落点）；simple=精简流程（implement→quality_review→done，不走 blocker 状态机）。首次新建状态时固化；已开始的变更仅切组（其他任务组均已完成或从未激活）或 recovery.phase=task_analysis 重制当前组（其他任务组同样须已完成或从未激活）时可更新，其余场景传不同 mode 报错。",
    schema: orchInitSchema
  },
  {
    name: "opx_orch_set_worktree",
    description: "确保目标组的 git worktree 就绪。change 会话按 change 模型 create-or-reuse：分支 change/{changeId} 不存在时从基准分支 tip 创建，worktree 常驻于 .worktree/{changeId}/ws，全部任务组串行复用（复用校验：目录缺失自愈重建、openspec 文档脏自动提交、代码文件脏拒绝）。只补齐资源，不改变阶段。",
    schema: setWorktreeSchema
  },
  {
    name: "opx_status",
    description: "统一状态/上下文查询（只读为主）。按调用者角色路由：编排视角→统计+worktree；architect→架构裁决视图（待处理 blocker 与执行边界，仅 blocker 回退时呈现）；developer→worktree/boundary/task/issue；reviewer-tool→tool 层控件 issue；reviewer-task→task 验证状态；quality reviewer→自维度既有 issue。",
    schema: statusSchema
  },
  {
    name: "opx_orch_complete_task_group",
    description: "完成任务组收尾。非最后任务组仅做门禁与范围标记（不合并、不销毁）；最后一个任务组收口时把 change 分支（change/{changeId}）一次性合并回 baseBranch（漂移无害——文档、openspec 规划路径或仅版本号变更的 package.json——时直接合并收口；漂移含任一其他文件或文本冲突时回退到收尾验证 verify_cleanup 并返回 blocked），成功后销毁 worktree 并删分支。须在收尾验证（verify_cleanup）通过后调用。主仓库本地改动文件与合并写入文件重合、或存在部分暂存文件时中止并返回 blocked（保留 worktree/分支）；主仓库无关脏文件不阻塞合并。",
    schema: completeTaskGroupSchema
  },
  {
    name: "opx_orch_set_unattended",
    description: "开启/关闭无人值守模式。开启后编排流程不再向用户提问：blocker 裁决与实施阶段的确认模式转为自行决策（架构裁决者裁决 blocker、开发者遇阻塞自行选择最优解，均不向用户确认）；重试检查点、状态异常等需拍板事项由主代理按编排行为准则自行决策并提交——检查点决策是 opx_agent_submit 工具调用，主代理可自行执行，不因无人值守而抑制。",
    schema: setUnattendedSchema
  },
  {
    name: "opx_agent_submit",
    description: "通用 step 提交，按 step_id 路由到 workflow 对应 step。校验调用者属于该 step 的 agents（越权直接拒绝），提交后推进 workflow 状态机并写回编排状态。可通过 exempt_adjudications 对已申请豁免的 issue 进行裁定（dismissed→cancelled、rejected→回 todo）；可通过 recheck_adjudications 复核已修复待复核（review 态）的 issue（passed→done、rejected→回 todo 并记 refix_count 与 reject_reason，谁提谁裁定）。",
    schema: agentSubmitSchema
  }
];

// src/adapters/deepseek-harness/native-tools.ts
var PRIMARY_AGENT = "primary";
function resolveToolContext(exec, args, opts) {
  const worktree = resolveSessionWorktree(exec, opts.processCwd);
  const raw = args[AGENT_ARG];
  const declared = typeof raw === "string" ? raw : "";
  const agent = declared !== "" ? declared : PRIMARY_AGENT;
  return {
    worktree,
    agent,
    orchestrator: agent === PRIMARY_AGENT,
    identityDeclared: declared !== ""
  };
}
function resolveSessionWorktree(exec, processCwd) {
  const sessionCwd = exec.agent?.session.header.cwd;
  if (typeof sessionCwd === "string" && sessionCwd !== "")
    return sessionCwd;
  if (exec.agent) {
    throw new Error("无法确定本次调用所属的项目目录：DSH 执行上下文未提供 agent.session.header.cwd（会话项目目录）。" + "进程启动目录是 DSH profile 目录（如 ~/.dsh/profiles/desktop），不是任何项目，继续执行会把编排状态写进错误目录，" + "因此本工具拒绝在缺会话目录时执行。请在项目会话中重新调用本工具。");
  }
  return processCwd;
}
var AGENT_ARG = "_agent";
async function ensureDefaultUnattended(args, ctx) {
  const changeId = typeof args.change_id === "string" ? args.change_id : undefined;
  if (!changeId)
    return;
  try {
    const state = await readStateByWorktree(ctx.worktree, changeId);
    if (state && state.unattended === undefined) {
      state.unattended = true;
      await writeState(ctx.worktree, state);
    }
  } catch {}
}
function buildNativeToolExecutes(unattended, processCwd) {
  const wrap = (execute) => async (args, exec) => {
    exec.signal?.throwIfAborted?.();
    const ctx = resolveToolContext(exec, args, { processCwd });
    const cleanArgs = structuredClone(args);
    delete cleanArgs[AGENT_ARG];
    if (unattended)
      await ensureDefaultUnattended(cleanArgs, ctx);
    const result = await execute(cleanArgs, ctx);
    if (unattended)
      await ensureDefaultUnattended(cleanArgs, ctx);
    return result;
  };
  return {
    opx_orch_init: wrap((args, ctx) => initExecute(args, ctx)),
    opx_orch_set_worktree: wrap((args, ctx) => setWorktreeExecute(args, ctx)),
    opx_status: wrap((args, ctx) => statusExecute({ change_id: args.change_id }, ctx)),
    opx_orch_complete_task_group: wrap((args, ctx) => completeTaskGroupExecute(args, ctx)),
    opx_orch_set_unattended: wrap((args, ctx) => setUnattendedExecute(args, ctx)),
    opx_agent_submit: wrap((args, ctx) => agentSubmitExecute(args, ctx))
  };
}
function buildNativeToolDefinitions(unattended, processCwd) {
  const executes = buildNativeToolExecutes(unattended, processCwd);
  return OPX_TOOL_SPECS.map((spec) => ({
    name: spec.name,
    description: spec.description,
    parameters: withAgentArg(jsonSchemaToToolParameters(spec.schema)),
    output: {
      schema: { type: "string" },
      render: (_args, value) => [{ type: "text", text: value }]
    },
    execute: executes[spec.name]
  }));
}
function withAgentArg(parameters) {
  return {
    ...parameters,
    [AGENT_ARG]: {
      type: "string",
      description: "调用者 agent 标识（子代理调用时传自身角色名，如 openspec-reviewer-tool；缺省为编排主代理视角）"
    }
  };
}

// src/adapters/deepseek-harness/plugin.ts
var Config = z.object({
  unattended: z.boolean().default(true),
  subagents: z.array(z.object({
    toolName: z.string(),
    agentPreset: z.string()
  })).default([])
});
var name = "openspec-opx-tools";
var inject = ["tools"];
function apply(ctx, config = {}) {
  const unattended = config.unattended !== false;
  const processCwd = process.cwd();
  for (const spec of buildNativeToolDefinitions(unattended, processCwd)) {
    ctx.tools.register(defineTool({
      name: spec.name,
      description: spec.description,
      parameters: spec.parameters,
      output: spec.output,
      async execute(args, exec) {
        return await spec.execute(args, exec);
      }
    }));
  }
  mountSubagentTools(ctx, config.subagents ?? []);
}
var SUBAGENT_TOOL_PACKAGE = "@deepseek-ai/dsh-tool-subagent";
var PRESET_READY_TIMEOUT_MS = 3000;
var PRESET_READY_POLL_MS = 50;
async function waitForPreset(registry, presetId, timeoutMs = PRESET_READY_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await registry.readDocument(presetId);
      return true;
    } catch {
      await new Promise((resolve3) => setTimeout(resolve3, PRESET_READY_POLL_MS));
    }
  }
  return false;
}
function mountSubagentTools(ctx, specs) {
  if (specs.length === 0 || typeof ctx.inject !== "function")
    return;
  ctx.inject(["agentPresets"], async (injected) => {
    let subagentTool;
    try {
      subagentTool = await import(SUBAGENT_TOOL_PACKAGE);
    } catch (error) {
      injected.logger?.warn?.(`openspec: 无法加载 ${SUBAGENT_TOOL_PACKAGE}，子代理委派工具未挂载：${String(error)}`);
      return;
    }
    for (const spec of specs) {
      if (!await waitForPreset(injected.agentPresets, spec.agentPreset)) {
        injected.logger?.warn?.(`openspec: agent preset "${spec.agentPreset}" 未在 ${PRESET_READY_TIMEOUT_MS}ms 内注册，跳过子代理工具 ${spec.toolName}`);
        continue;
      }
      try {
        await injected.plugin(subagentTool, {
          provider: "spawn",
          toolName: spec.toolName,
          agentPreset: spec.agentPreset
        });
      } catch (error) {
        injected.logger?.warn?.(`openspec: 子代理工具 ${spec.toolName} 挂载失败：${String(error)}`);
      }
    }
  });
}
export {
  name,
  inject,
  apply,
  Config
};
