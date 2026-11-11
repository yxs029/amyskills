#!/usr/bin/env python3
"""断联容灾演练 v3 —— 进程内 AIAgent + 真实 fallback 链
关键点：fallback 的 named-custom 解析只认 config 文件里的 providers 条目，
链内嵌 base_url 会被忽略 → 模拟 L1/L2 断联必须改 config 文件后重新 load。
证据：agent.model/provider 终值（fallback 激活时被改写）。
"""
import os, sys, time, shutil
import yaml

for line in open(os.path.expanduser("~/.hermes/.env")):
    if "=" in line and not line.startswith("#"):
        k, v = line.strip().split("=", 1)
        os.environ.setdefault(k, v)

sys.path.insert(0, "/home/aaronmy/.hermes/hermes-agent/venv/lib/python3.11/site-packages")
from hermes_cli.fallback_config import get_fallback_chain
from run_agent import AIAgent

CFG = os.path.expanduser("~/.hermes/config.yaml")
SNAP = CFG + ".pre-failover-drill-v3"
DEAD = "http://127.0.0.1:9"

shutil.copy2(CFG, SNAP)

def load():
    cfg = yaml.safe_load(open(CFG))
    chain = get_fallback_chain(cfg)
    pcfg = cfg["providers"]["volcengine-agent-plan"]
    def expand(v):
        if isinstance(v, str) and v.startswith("${") and v.endswith("}"):
            return os.environ.get(v[2:-1], "")
        return v
    primary = dict(
        model=cfg["model"]["default"], provider=cfg["model"]["provider"],
        base_url=cfg["model"]["base_url"], api_key=expand(pcfg["api_key"]),
        api_mode="anthropic_messages",
    )
    return cfg, chain, primary

def file_patch(old, new):
    src = open(CFG).read()
    assert src.count(old) == 1, f"file_patch 匹配失败({src.count(old)}): {old[:60]!r}"
    open(CFG, "w").write(src.replace(old, new, 1))

def run(tag, expect, primary_override=None):
    cfg, chain, primary = load()
    p = dict(primary, **(primary_override or {}))
    t0 = time.time()
    try:
        agent = AIAgent(max_iterations=3, quiet_mode=True, platform="cli",
                        skip_context_files=True, skip_memory=True,
                        fallback_model=chain, **p)
        r = agent.run_conversation(user_message="你好，回复两个字即可",
                                   system_message="你是测测，直接简短回答。")
        dur = time.time() - t0
        got = f"{agent.model}@{agent.provider}"
        ok = agent.model == expect
        print(f"[{tag}] {'✅' if ok else '❌'} expect={expect} got={got} "
              f"fallback_on={getattr(agent,'_fallback_activated',None)} "
              f"idx={getattr(agent,'_fallback_index',None)} dur={dur:.0f}s "
              f"答:{(r.get('final_response') or '')[:40]!r}", flush=True)
        return ok
    except Exception as e:
        print(f"[{tag}] ❌ 异常 {type(e).__name__}: {str(e)[:200]} ({time.time()-t0:.0f}s)", flush=True)
        return False

results = {}
# T0 基线：主模型正常
results["T0"] = run("T0-基线", "doubao-seed-evolving")
# T1 断主（显式主参数指死地址，链完好）→ L1
results["T1"] = run("T1-断主降L1", "MiniMax-M3",
                    primary_override={"base_url": DEAD, "api_key": "dead"})
# T2：config 文件里把 L1 provider 指死 → 重新 load → 断主 → L2
file_patch("  minimax-coding-plan:\n    api_key: ${MINIMAX_CODING_PLAN_API_KEY}\n    api_mode: chat_completions\n    base_url: https://api.minimaxi.com/v1",
           "  minimax-coding-plan:\n    api_key: ${MINIMAX_CODING_PLAN_API_KEY}\n    api_mode: chat_completions\n    base_url: " + DEAD)
results["T2"] = run("T2-断L1降L2", "agnes-3.0-flash",
                    primary_override={"base_url": DEAD, "api_key": "dead"})
# T3：再把 L2 provider 指死 → 断主 → L3
file_patch("  agnesai:\n    api_key: ${AGNESAI_API_KEY}\n    api_mode: chat_completions\n    base_url: https://apihub.agnes-ai.com/v1",
           "  agnesai:\n    api_key: ${AGNESAI_API_KEY}\n    api_mode: chat_completions\n    base_url: " + DEAD)
results["T3"] = run("T3-断L2降L3", "openrouter/free",
                    primary_override={"base_url": DEAD, "api_key": "dead"})

# 恢复
shutil.copy2(SNAP, CFG)
v = open(CFG).read()
assert "default: doubao-seed-evolving" in v and DEAD not in v
print("[RESTORE] 配置已恢复 ✅", flush=True)

print("\n===== 演练汇总 =====", flush=True)
for k, v in results.items():
    print(f"{'✅' if v else '❌'} {k}", flush=True)
print("总结:", "全部通过 ✅" if all(results.values()) else "存在失败 ❌", flush=True)
