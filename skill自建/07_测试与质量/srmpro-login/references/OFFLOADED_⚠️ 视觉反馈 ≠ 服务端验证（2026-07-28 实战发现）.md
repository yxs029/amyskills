## ⚠️ 视觉反馈 ≠ 服务端验证（2026-07-28 实战发现）

**问题**：滑块拖动后 UI 显示绿色（视觉反馈），但登录按钮仍 `disabled`（实际服务端验证失败）。

**判别方法**（不要被假象骗了）：

```javascript
// 必须等 2 秒看按钮状态
await new Promise(r => setTimeout(r, 2000));
const btn = document.querySelector('button[ref*="login"], button:has-text("login")');
const realStatus = {
  url: location.href,
  loginBtnDisabled: btn?.disabled,  // ← 真实状态
  sliderVisualGreen: !!document.querySelector('[class*="verify"][class*="success"]'),
};
console.log(realStatus);
// 失败样本: loginBtnDisabled=true 但 sliderVisualGreen=true
// 成功样本: loginBtnDisabled=false 且 page.goto('/index') 后不在 /login
```

**根本原因**：SRMPRO 滑块是**服务端验证**（v3.0 server-side captcha code）—— UI 显示绿色可能是 local state 更新，但服务端 session 没有真正通过验证。

**不要**：
- 用图像模型估计滑块坐标 → 点击 → 看到绿色就以为成功
- 用 JavaScript dispatchEvent 触发 mouse events（v1.0 路径）→ 服务端识别为机器人
- 用 Xvfb + 真实鼠标拖动 → 服务端识别为 headless chromium

**要**：
- 用 `bi-automation/venv/bin/python` + `robust_login()` —— 已验证 100% 成功（2026-06-04 实战）
- 如果还是失败，回退到 `verify-slider-bypass` skill 的 v1.7/v1.8 阶梯
- **终极方案**：让老大在浏览器手动登录，导出 `context.storage_state(path=...)`，下次直接 `storage_state=` 复用

**判别陷阱**：跑完登录后**必须**用 `assert '/index' in page.url` 验证最终状态，不要被 slider 绿色迷惑。
