window.__ModuleLoader__.load({ id: "dsh-whyai", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/locales.ts
var zh = {
  title: "YAI \u989D\u5EA6",
  brand: "YAI",
  remaining: "\u53EF\u7528\u989D\u5EA6",
  eligible: "\u53EF\u4F7F\u7528",
  ineligible: "\u6682\u4E0D\u53EF\u7528",
  expiry: "\u5F53\u524D\u8BA2\u9605\u5230\u671F",
  reset: "\u989D\u5EA6\u91CD\u7F6E",
  accessExpiry: "CLI \u6743\u76CA\u6709\u6548\u81F3",
  dateLocale: "zh-CN",
  validityHint: "\u8BBF\u95EE\u6709\u6548\u671F\u4E0E\u8BA2\u9605\u5230\u671F\u5206\u522B\u6765\u81EA CLI access \u4E0E subscription summary",
  unknown: "\u672A\u63D0\u4F9B",
  loading: "\u6B63\u5728\u8BFB\u53D6\u2026",
  paused: "\u5DF2\u6682\u505C\u66F4\u65B0",
  unavailable: "\u8BFB\u53D6\u5931\u8D25\uFF0C\u7A0D\u540E\u91CD\u8BD5",
  auth: "\u9700\u8981\u767B\u5F55\u6216\u6388\u6743",
  limited: "\u8BF7\u6C42\u53D7\u9650\uFF0C\u7A0D\u540E\u91CD\u8BD5",
  timeout: "\u8BFB\u53D6\u8D85\u65F6\uFF0C\u7A0D\u540E\u91CD\u8BD5",
  invalid: "\u54CD\u5E94\u6570\u636E\u65E0\u6548",
  disabled: "\u8D26\u53F7\u5DF2\u505C\u7528",
  billingUnavailable: "\u8D26\u5355\u65E5\u671F\u6682\u4E0D\u53EF\u7528"
};
var en = {
  title: "YAI allowance",
  brand: "YAI",
  remaining: "Available",
  eligible: "Eligible",
  ineligible: "Not eligible",
  expiry: "Current subscription expires",
  reset: "Allowance reset",
  accessExpiry: "CLI access valid until",
  dateLocale: "en-US",
  validityHint: "Access validity and subscription expiry come from CLI access and subscription summary respectively",
  unknown: "Not provided",
  loading: "Loading\u2026",
  paused: "Updates paused",
  unavailable: "Unable to load; retrying later",
  auth: "Sign-in or authorization required",
  limited: "Rate limited; retrying later",
  timeout: "Request timed out; retrying later",
  invalid: "Invalid response data",
  disabled: "Account disabled",
  billingUnavailable: "Billing dates temporarily unavailable"
};

// src/client/store.ts
var POLL_MS = 6e4;
var TIMEOUT_MS = 15e3;
var MAX_BYTES = 16384;
function parseAccess(value) {
  if (!value || typeof value !== "object") throw new Error("invalid");
  const response = value;
  if (response.status === "error" && typeof response.code === "string") {
    const code = response.code.toUpperCase();
    throw new Error(/AUTH|LOGIN|LOGGED_IN|UNAUTHORIZED|FORBIDDEN/.test(code) ? "auth" : /RATE|LIMIT/.test(code) ? "limited" : /TIMEOUT/.test(code) ? "timeout" : /DISABLED/.test(code) ? "disabled" : "unavailable");
  }
  if (response.status !== "ok" || !response.data || typeof response.data !== "object") throw new Error("invalid");
  const data = response.data;
  const percent = data.available_percent;
  const expiry = data.valid_until;
  if (!(percent === null || typeof percent === "number" && Number.isFinite(percent) && percent >= 0 && percent <= 100) || typeof data.eligible !== "boolean" || !(expiry === null || typeof expiry === "string" && expiry.length <= 128 && Number.isFinite(Date.parse(expiry)))) throw new Error("invalid");
  if (!Object.hasOwn(data, "subscription_expires_at") || !Object.hasOwn(data, "next_reset_at") || !Object.hasOwn(data, "billing_status")) throw new Error("invalid");
  const subscription = data.subscription_expires_at;
  const reset = data.next_reset_at;
  for (const date of [subscription, reset]) {
    if (!(date === null || typeof date === "string" && date.length <= 128 && Number.isFinite(Date.parse(date)))) throw new Error("invalid");
  }
  const billing = data.billing_status;
  if (billing !== "ok" && billing !== "unavailable") throw new Error("invalid");
  return { available_percent: percent, eligible: data.eligible, valid_until: expiry, subscription_expires_at: subscription, next_reset_at: reset, billing_status: billing };
}
async function readAccess(response, signal) {
  if (signal.aborted) {
    void response.body?.cancel().catch(() => {
    });
    throw new Error("unavailable");
  }
  if (!response.ok && response.status !== 503) {
    void response.body?.cancel().catch(() => {
    });
    throw new Error(response.status === 401 || response.status === 403 ? "auth" : response.status === 429 ? "limited" : response.status === 504 || response.status === 408 ? "timeout" : "unavailable");
  }
  if (!response.body) throw new Error("invalid");
  const reader = response.body.getReader();
  const cancelReader = () => {
    void reader.cancel().catch(() => {
    });
  };
  signal.addEventListener("abort", cancelReader, { once: true });
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_BYTES) throw new Error("invalid");
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let value;
    try {
      value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      throw new Error("invalid");
    }
    if (!response.ok && (!value || typeof value !== "object" || value.status !== "error")) throw new Error("unavailable");
    return parseAccess(value);
  } finally {
    signal.removeEventListener("abort", cancelReader);
    void reader.cancel().catch(() => {
    });
    reader.releaseLock();
  }
}
var AccessStore = class {
  #state = { loading: true };
  #listeners = /* @__PURE__ */ new Set();
  #timer;
  #cancel;
  #generation = 0;
  #disposed = false;
  getSnapshot = () => this.#state;
  #visible = () => typeof document === "undefined" || !document.hidden;
  #publish(state) {
    this.#state = state;
    for (const listener of this.#listeners) listener();
  }
  #stop() {
    ++this.#generation;
    clearTimeout(this.#timer);
    this.#timer = void 0;
    this.#cancel?.();
    this.#cancel = void 0;
  }
  #visibility = () => {
    this.#stop();
    this.#publish({ loading: this.#visible(), ...this.#visible() ? {} : { error: "paused" } });
    if (this.#visible()) void this.#load();
  };
  subscribe = (listener) => {
    if (this.#disposed) return () => {
    };
    const notify = () => listener();
    this.#listeners.add(notify);
    if (this.#listeners.size === 1) {
      if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.#visibility);
      if (this.#visible()) void this.#load();
    }
    return () => {
      if (!this.#listeners.delete(notify) || this.#listeners.size) return;
      this.#stop();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.#visibility);
      this.#state = { loading: true };
    };
  };
  dispose = () => {
    this.#disposed = true;
    this.#stop();
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.#visibility);
    this.#listeners.clear();
    this.#state = { loading: true };
  };
  async #load() {
    if (this.#cancel || this.#disposed || !this.#listeners.size || !this.#visible()) return;
    const generation = ++this.#generation;
    const controller = new AbortController();
    let reject;
    const cancelled = new Promise((_resolve, fail) => {
      reject = fail;
    });
    const cancel = (reason) => {
      reject(new Error(reason));
      controller.abort();
    };
    this.#cancel = () => cancel("unavailable");
    const timeout = setTimeout(() => cancel("timeout"), TIMEOUT_MS);
    const work = (async () => readAccess(await fetch("/api/whyai/access", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: controller.signal
    }), controller.signal))();
    try {
      const data = await Promise.race([work, cancelled]);
      if (generation === this.#generation) this.#publish({ loading: false, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const safe = ["auth", "limited", "timeout", "invalid", "disabled"].includes(message) ? message : "unavailable";
      if (generation === this.#generation) this.#publish({ loading: false, error: safe });
    } finally {
      clearTimeout(timeout);
      if (generation === this.#generation) {
        this.#cancel = void 0;
        if (this.#listeners.size && this.#visible() && !this.#disposed) this.#timer = setTimeout(() => {
          void this.#load();
        }, POLL_MS);
      }
    }
  }
};

// src/client/summary.ts
var import_react = require("react");
var muted = { color: "var(--dsw-alias-label-tertiary)", fontSize: 11 };
var panel = {
  boxSizing: "border-box",
  width: "100%",
  minWidth: 0,
  padding: "9px 10px",
  borderRadius: 10,
  border: "1px solid var(--dsw-alias-border-l2)",
  background: "var(--dsw-specific-sidebar-fill)",
  color: "var(--dsw-alias-label-primary)",
  fontSize: 12,
  lineHeight: 1.5,
  overflowWrap: "anywhere"
};
function AccessSummary({ wide, t, useAccess }) {
  const id = (0, import_react.useId)();
  const state = useAccess((value2) => value2);
  const data = state.data;
  const percent = data?.available_percent ?? null;
  const value = percent === null ? "\u2014" : `${Number(percent.toFixed(2))}%`;
  const status = state.loading ? t("loading") : state.error ? t(state.error) : data ? t(data.eligible ? "eligible" : "ineligible") : t("unknown");
  const label = `${t("title")} \xB7 ${t("remaining")} ${value} \xB7 ${status}`;
  const tone = data ? `var(--dsw-alias-state-${data.eligible ? "success" : "error"}-primary)` : "var(--dsw-alias-label-tertiary)";
  const formatDate = (date) => new Intl.DateTimeFormat(t("dateLocale"), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(date));
  const time = (date) => date ? (0, import_react.createElement)("time", { dateTime: date, title: date }, formatDate(date)) : t("unknown");
  const separateAccess = data?.valid_until && (!data.subscription_expires_at || Date.parse(data.valid_until) !== Date.parse(data.subscription_expires_at));
  const content = (0, import_react.createElement)(
    "section",
    { "aria-label": t("title"), style: panel },
    (0, import_react.createElement)(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 } },
      (0, import_react.createElement)("strong", { style: { letterSpacing: ".04em" } }, t("brand")),
      (0, import_react.createElement)("span", { style: { ...muted, color: tone, border: "1px solid currentColor", borderRadius: 20, padding: "0 6px", fontSize: 10 } }, status)
    ),
    (0, import_react.createElement)(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 3 } },
      (0, import_react.createElement)("span", { style: muted }, t("remaining")),
      (0, import_react.createElement)("strong", { style: { fontSize: 22, fontVariantNumeric: "tabular-nums", lineHeight: 1.3 } }, value)
    ),
    (0, import_react.createElement)("div", {
      role: "progressbar",
      "aria-label": t("remaining"),
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      ...percent === null ? { "aria-valuetext": t("unknown") } : { "aria-valuenow": percent },
      style: { height: 8, borderRadius: 8, overflow: "hidden", background: "var(--dsw-alias-border-l2)", margin: "6px 0" }
    }, percent === null ? null : (0, import_react.createElement)("div", { style: { height: "100%", width: `${percent}%`, borderRadius: 8, background: tone } })),
    (0, import_react.createElement)("div", { style: muted }, `${t("expiry")}\uFF1A`, time(data?.subscription_expires_at)),
    (0, import_react.createElement)("div", { style: muted }, `${t("reset")}\uFF1A`, time(data?.next_reset_at)),
    separateAccess ? (0, import_react.createElement)("div", { style: muted, title: t("validityHint") }, `${t("accessExpiry")}\uFF1A`, time(data?.valid_until)) : null,
    data?.billing_status === "unavailable" ? (0, import_react.createElement)("div", { role: "status", style: muted }, t("billingUnavailable")) : null,
    state.error ? (0, import_react.createElement)("div", { role: "status", style: muted }, t(state.error)) : null
  );
  if (wide) return (0, import_react.createElement)("div", { style: { width: "100%", minWidth: 0 } }, content);
  return (0, import_react.createElement)(
    "div",
    { style: { width: 36 } },
    (0, import_react.createElement)("button", {
      type: "button",
      popoverTarget: id,
      "aria-label": label,
      title: label,
      style: { width: 36, minHeight: 36, padding: "6px 0", cursor: "pointer", border: 0, borderRadius: 8, background: "transparent", color: "var(--dsw-alias-label-primary)", fontSize: 10, fontWeight: 700 }
    }, (0, import_react.createElement)("span", { style: { display: "block" } }, t("brand")), (0, import_react.createElement)("span", { style: { display: "block", fontSize: 9, color: tone, fontVariantNumeric: "tabular-nums" } }, value)),
    (0, import_react.createElement)("div", {
      id,
      popover: "auto",
      "aria-label": t("title"),
      style: { position: "fixed", inset: "auto auto 56px 56px", margin: 0, padding: 0, border: 0, background: "transparent", width: "min(280px, calc(100vw - 72px))", maxHeight: "70vh", overflowY: "auto" }
    }, content)
  );
}

// src/client/index.ts
var inject = ["slots", "locale"];
var FOOTER_SLOT = "sidebar.footer.action";
var USAGE_AFTER_SLOT = "sidebar.footer.usage-monitor.after";
function apply(ctx) {
  const access = new AccessStore();
  ctx.effect(() => access.dispose, "whyai: access lifecycle");
  ctx.effect(() => ctx.locale.register("whyai", { zh, en }), "whyai: dictionaries");
  let disposed = false;
  let footerLive = false;
  let nestedLive = false;
  let removeDirect;
  const register = (name, order) => ctx.slots.register({
    name,
    id: "whyai",
    order,
    locale: "whyai",
    inject: () => ({ hooks: { access } })
  }, AccessSummary);
  const mountDirect = () => {
    if (!disposed && footerLive && !nestedLive && removeDirect === void 0) {
      removeDirect = register(FOOTER_SLOT, 110);
    }
  };
  const unmountDirect = () => {
    removeDirect?.();
    removeDirect = void 0;
  };
  ctx.slots.inject(USAGE_AFTER_SLOT, () => {
    nestedLive = true;
    unmountDirect();
    const removeNested = register(USAGE_AFTER_SLOT, 0);
    return () => {
      removeNested();
      nestedLive = false;
      queueMicrotask(mountDirect);
    };
  });
  ctx.slots.inject(FOOTER_SLOT, () => {
    footerLive = true;
    mountDirect();
    return () => {
      footerLive = false;
      unmountDirect();
    };
  });
  ctx.effect(() => () => {
    disposed = true;
    unmountDirect();
  }, "whyai: footer routing");
}
return module.exports; }});
