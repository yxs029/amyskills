# hermes-model-switchover-drill

<p align="center">
  <img src="https://img.shields.io/badge/version-v1.4.0-1D4ED8?style=flat" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-3DA639?style=flat" alt="license">
  <img src="https://img.shields.io/badge/network-%E5%85%A8%E5%85%AC%E7%BD%91%E7%9B%B4%E8%BF%9E-B45309?style=flat" alt="network">
</p>

> Hermes 主备模型切换 + 多级容灾链 + 断联演练一条龙。
> v1.4.0 可移植链方案 v2：**全公网直连、零本地依赖**——任何机器凭 5 把 key 即可复刻。

## 容灾链序（v2 可移植版）

```
主   zhipu / glm-5.3-flash                    智谱官网 bigmodel coding paas   1M
 ↓ 降级
L1   minimax-coding-plan / MiniMax-M3.1-Flash MiniMax 官方 api.minimaxi.com   1M
 ↓
L2   baishan / GLM-5.3-Flash                  白山 api.edgefn.net             1M
 ↓
L3   agnesai / agnes-3.0-flash                AgnesAI                         512K
 ↓
L4   openrouter / openrouter/free             OpenRouter                      128K
```

## 30 秒安装

```bash
# 1. 克隆到 Hermes 技能目录
git clone https://github.com/yxs029/amyskills.git /tmp/amyskills
cp -r /tmp/amyskills/agent共用skills/hermes-model-switchover-drill ~/.hermes/skills/devops/

# 2. ~/.hermes/.env 放五把 key（chmod 600）
#    ZHIPU_BIGMODEL_KEY / MINIMAX_CODING_PLAN_API_KEY / BAISHAN_KEY / AGNESAI_API_KEY / OPENROUTER_API_KEY

# 3. 按 SKILL.md 第 9 节改 config.yaml（providers 模板 + fallback 链，全在 skill 里）
```

## 三验（切完必做）

```bash
hermes fallback          # 1) 看解析链序
hermes chat -q '正常'    # 2) 端到端应答
systemctl --user restart hermes-gateway   # 3) 通道生效
```

## 触发词

「切换主模型」「配备用模型」「改 fallback」「模型断联演练」「验证容灾链」

## 实测坑表（skill 内含完整版）

- fallback/providers 的 key 字段名是 `key_env`（不是 `api_key_env`，写错静默 401）
- 502/500 **不**触发降级，只有 429/401 触发；断链演练用 fake 429 上游 + 链裁剪
- 主备同 provider 时断链法失效 → 同源等价论证
- 模型 id 大小写敏感：智谱小写 `glm-5.3-flash`、白山大写 `GLM-5.3-Flash`、MiniMax 大写 `MiniMax-M3.1-Flash`
