#!/usr/bin/env python3
"""长任务模式 preflight 检查: 读 hermes config.yaml 输出配置基线报告
用法: python3 longtask_preflight.py [config路径, 默认 ~/.hermes/config.yaml]
退出码: 0=长任务模式达标 / 1=未达标(有参数还在默认值)
"""
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("[FATAL] 需要 pyyaml: pip install pyyaml")
    sys.exit(2)

# 参数定义: (config.yaml 路径键, 默认值, 长任务达标值, 说明)
CHECKS = [
    (['agent', 'max_turns'], 90, 500, '主会话步数上限'),
    (['delegation', 'max_iterations'], 50, 200, '子Agent迭代上限'),
    (['delegation', 'max_spawn_depth'], 1, 2, 'spawn 层数'),
    (['terminal', 'timeout'], 180, 600, '前台命令上限(秒)'),
]

def dig(d, keys):
    for k in keys:
        if not isinstance(d, dict) or k not in d:
            return None
        d = d[k]
    return d

def main():
    cfg_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / '.hermes/config.yaml'
    if not cfg_path.exists():
        print(f"[FATAL] 配置不存在: {cfg_path}")
        sys.exit(2)
    cfg = yaml.safe_load(cfg_path.read_text()) or {}
    print(f"=== LongTask Preflight | {cfg_path} ===")
    print(f"{'参数':<32}{'默认':>6}{'当前':>8}{'达标':>6}  说明")
    ok = True
    for keys, default, target, desc in CHECKS:
        cur = dig(cfg, keys)
        cur = default if cur is None else cur
        passed = cur >= target
        ok = ok and passed
        name = '.'.join(keys)
        print(f"{name:<32}{default:>6}{cur:>8}{'✅' if passed else '❌':>6}  {desc} (达标线{target})")
    print(f"\n结论: {'✅ 长任务模式达标' if ok else '❌ 未达标 — 按 SKILL.md §3.2 用 hermes config set 调整(改前先备份)'}")
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
