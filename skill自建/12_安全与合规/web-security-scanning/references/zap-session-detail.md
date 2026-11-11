# Session detail: xplorechips ZAP scan (2026-09-09)

## Login flow
- Target: https://www.xplorechips.com
- Credentials: yxs029@126.com / via env XPLORE_PASS
- Flow: GET /signin → _csrf → POST /account → 302 / → 3 cookies
- Verify: GET /account/ → 200 with "退出"/"logout"/"yxs029"

## Cookie details
- userSecret: 32 hex chars (ab2d392679c44db9...)
- session: 262 chars (ZJbGDikUhw52dGAh...)
- authToken: 1344 chars, JWT (eyJhbGciOi...)
- Cookie header: `userSecret=xxx; session=yyy; authToken=zzz`

## Scripts created (in 04-测试过程/script/)
- login_direct.py: direct login verification (no proxy)
- 01_setup_context.py: create context, login through proxy, bind session
- 02_relogin_proxy.py: re-login through proxy after HttpStateEnabled
- 03_inject_session.py: inject 3 cookies into httpSessions "auth" session
- 04_verify_session.py: verify clean-jar proxy request gets auth
- 05_spider.py: spider scan with context, subtreeOnly, maxDuration
- 05b_wait_spider.py: poll spider 0/1 to completion
- 06_ensure_context.py: idempotent context setup with includes/excludes

## ZAP 2.17 API quirks reference
- HttpStateEnabled: GET /JSON/core/action/setOptionHttpStateEnabled/?Boolean=true
- createEmptySession: GET /JSON/httpSessions/action/createEmptySession/?site=www.xplorechips.com:443&session=auth
- setSessionTokenValue: params sessionToken / tokenValue (not name/value)
- setActiveSession: param session (name, not sessionId)
- session structure: {"sessions":[{"session":["name",{tokenDict}]]}
- includeInContext: params contextName + regex
- setContextInScope: params contextName + booleanInScope
- Options: param names depend on type (Integer/Boolean/String)
- Spider view: fullResults vs resultsFull, results takes scanId

## Doc structure
- 00-顶层文档-OPRASE格式.md / 01-使用工具概要 / 02-SOP / 03-基础信息
- 04-测试过程/script/ + testdata/ ~session_cookie.txt, step3_*.json
- 05-测试报告/ (reports)
- 06-测试复盘/ (retrospectives)