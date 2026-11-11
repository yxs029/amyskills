/* dsh-whyai — Host plugin. Generated from src/. */

// src/config.ts
import z from "@deepseek-ai/schemastery";
import { isAbsolute } from "node:path";
var DEFAULT_TIMEOUT_MS = 18e4;
var DEFAULT_GRACE_MS = 2e3;
var DEFAULT_STDOUT_MAX_BYTES = 4 * 1024 * 1024;
var DEFAULT_STDERR_MAX_BYTES = 256 * 1024;
var DEFAULT_PROMPT_MAX_BYTES = 128 * 1024;
var DEFAULT_PARTNER_LIMIT = 10;
var Config = z.object({
  cliPath: z.string().default("whyai"),
  timeoutMs: z.number().step(1).min(1).max(18e5).default(DEFAULT_TIMEOUT_MS),
  graceMs: z.number().step(1).min(1).max(3e4).default(DEFAULT_GRACE_MS),
  stdoutMaxBytes: z.number().step(1).min(1024).max(16 * 1024 * 1024).default(DEFAULT_STDOUT_MAX_BYTES),
  stderrMaxBytes: z.number().step(1).min(1024).max(1024 * 1024).default(DEFAULT_STDERR_MAX_BYTES),
  promptMaxBytes: z.number().step(1).min(1).max(1024 * 1024).default(DEFAULT_PROMPT_MAX_BYTES),
  partnerLimit: z.number().step(1).min(1).max(50).default(DEFAULT_PARTNER_LIMIT),
  requireApproval: z.boolean().default(false)
});
function integerInRange(value, min, max, name2) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`whyai ${name2} must be an integer from ${min} to ${max}`);
  }
}
function validateConfig(config) {
  const path = config.cliPath.trim();
  if (!path) throw new Error("whyai cliPath must not be empty");
  if (path !== config.cliPath) throw new Error("whyai cliPath must not have surrounding whitespace");
  if (!isAbsolute(path) && /[\\/]/u.test(path)) {
    throw new Error("whyai cliPath must be an absolute path or a bare executable name");
  }
  integerInRange(config.timeoutMs, 1, 18e5, "timeoutMs");
  integerInRange(config.graceMs, 1, 3e4, "graceMs");
  integerInRange(config.stdoutMaxBytes, 1024, 16 * 1024 * 1024, "stdoutMaxBytes");
  integerInRange(config.stderrMaxBytes, 1024, 1024 * 1024, "stderrMaxBytes");
  integerInRange(config.promptMaxBytes, 1, 1024 * 1024, "promptMaxBytes");
  integerInRange(config.partnerLimit, 1, 50, "partnerLimit");
  if (typeof config.requireApproval !== "boolean") throw new Error("whyai requireApproval must be boolean");
}

// src/runner.ts
var WhyAiCliError = class extends Error {
  code;
  status;
  constructor(message, code, status) {
    super(message);
    this.name = "WhyAiCliError";
    this.code = code;
    this.status = status;
  }
};
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseJson(text2, label) {
  try {
    return JSON.parse(text2);
  } catch {
    throw new WhyAiCliError(`WhyAI CLI returned malformed ${label} JSON`, "WHYAI_MALFORMED_OUTPUT");
  }
}
function classifyExternalError(raw, status, rawCode) {
  const code = typeof rawCode === "string" || typeof rawCode === "number" ? String(rawCode).toUpperCase() : "";
  if (/not logged in/iu.test(raw)) return { message: "WhyAI CLI is not logged in; run whyai login.", code: "WHYAI_NOT_LOGGED_IN" };
  if (/quota.+exhausted/iu.test(raw) || code.includes("QUOTA")) return { message: "WhyAI CLI quota is exhausted.", code: "WHYAI_QUOTA_EXHAUSTED" };
  if (/account.+disabled/iu.test(raw)) return { message: "The WhyAI account is disabled.", code: "WHYAI_ACCOUNT_DISABLED" };
  if (/active paid plan/iu.test(raw)) return { message: "WhyAI CLI requires an active paid plan.", code: "WHYAI_PAID_PLAN_REQUIRED" };
  if (/partner not found/iu.test(raw)) return { message: "The requested WhyAI Partner was not found.", code: "WHYAI_PARTNER_NOT_FOUND" };
  if (status === 404 || code === "NOT_FOUND") return { message: "The requested WhyAI resource was not found.", code: "WHYAI_NOT_FOUND" };
  if (code.includes("PERSIST")) return { message: "WhyAI could not persist the response.", code: "WHYAI_PERSIST_FAILED" };
  return { message: "WhyAI CLI command failed.", code: "WHYAI_COMMAND_FAILED" };
}
function parseError(value) {
  if (!isRecord(value) || !isRecord(value.error) || typeof value.error.message !== "string") return void 0;
  const rawStatus = value.error.status;
  const status = typeof rawStatus === "number" && Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus <= 599 ? rawStatus : void 0;
  const classified = classifyExternalError(value.error.message, status, value.error.code);
  return { ...classified, ...status === void 0 ? {} : { status } };
}
function readComplete(reader, label) {
  if (!reader) throw new WhyAiCliError(`WhyAI CLI produced no collected ${label}`, "WHYAI_PROCESS_FAILED");
  let output;
  try {
    output = reader.readFrom(0);
  } catch {
    throw new WhyAiCliError(`WhyAI CLI ${label} could not be read`, "WHYAI_PROCESS_FAILED");
  }
  if (output.lossy) throw new WhyAiCliError(`WhyAI CLI ${label} exceeded its configured byte limit`, "WHYAI_OUTPUT_OVERFLOW");
  return output.text;
}
var DISPOSED = Symbol("WhyAI plugin disposed");
function abortError(signal, timeout) {
  if (signal.aborted && signal.reason === DISPOSED) return new WhyAiCliError("WhyAI plugin was disposed", "WHYAI_DISPOSED");
  if (timeout?.aborted && !signal.aborted) return new WhyAiCliError("WhyAI CLI timed out", "WHYAI_TIMEOUT");
  return new WhyAiCliError("WhyAI CLI was cancelled", "WHYAI_CANCELLED");
}
function untilAbort(pending, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(new Error("operation aborted"));
    };
    pending.then((value) => {
      signal.removeEventListener("abort", abort);
      resolve(value);
    }, () => {
      signal.removeEventListener("abort", abort);
      reject(new Error("subprocess provider failed"));
    });
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}
async function waitForQuiescence(handle, timeoutMs) {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), timeoutMs);
  try {
    return await untilAbort(handle.waitForExit(deadline.signal), deadline.signal);
  } finally {
    clearTimeout(timer);
  }
}
var WhyAiCliRunner = class {
  constructor(subprocess, config, cwd = process.cwd()) {
    this.subprocess = subprocess;
    this.config = config;
    this.cwd = cwd;
  }
  lifetime = new AbortController();
  waiters = [];
  inFlight = /* @__PURE__ */ new Set();
  activeHandles = /* @__PURE__ */ new Set();
  busy = false;
  // A failed cleanup must never permit another process to overlap an orphan.
  poisoned = false;
  async invoke(args, stdin, signal) {
    return this.serialized(signal, async (operationSignal) => {
      const raw = await this.run(args, stdin, operationSignal);
      const stdoutValue = raw.stdout ? parseJson(raw.stdout, "stdout") : void 0;
      const stderrValue = raw.exitCode !== 0 && raw.stderr ? parseJson(raw.stderr.split(/\n/u).at(-1) ?? "", "stderr") : void 0;
      const error = parseError(stderrValue);
      if (raw.exitCode === 0 && stdoutValue === void 0) {
        throw new WhyAiCliError("WhyAI CLI returned no JSON result", "WHYAI_MALFORMED_OUTPUT");
      }
      if (raw.exitCode !== 0 && error === void 0) {
        throw new WhyAiCliError(`WhyAI CLI failed with exit code ${raw.exitCode}`, "WHYAI_PROCESS_FAILED");
      }
      return {
        exitCode: raw.exitCode,
        ...stdoutValue === void 0 ? {} : { value: stdoutValue },
        ...error === void 0 ? {} : { error },
        hadWarning: raw.exitCode === 0 && raw.stderr.length > 0
      };
    });
  }
  async version(signal) {
    return this.serialized(signal, async (operationSignal) => {
      const raw = await this.run(["--version"], void 0, operationSignal);
      if (raw.exitCode !== 0) throw new WhyAiCliError("WhyAI CLI version check failed", "WHYAI_COMMAND_FAILED");
      const version = raw.stdout.trim();
      if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version)) {
        throw new WhyAiCliError("WhyAI CLI returned an invalid version", "WHYAI_MALFORMED_OUTPUT");
      }
      return version;
    });
  }
  async dispose() {
    if (!this.lifetime.signal.aborted) this.lifetime.abort(DISPOSED);
    await Promise.allSettled([...this.inFlight]);
    const cleanupErrors = [];
    for (const handle of [...this.activeHandles]) {
      try {
        await this.stop(handle);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (cleanupErrors.length > 0) throw new AggregateError(cleanupErrors, "WhyAI CLI process cleanup failed");
  }
  async serialized(signal, operation) {
    const operationSignal = AbortSignal.any([signal, this.lifetime.signal]);
    const task = (async () => {
      const release = await this.acquire(operationSignal);
      try {
        return await operation(operationSignal);
      } finally {
        release();
      }
    })();
    const tracked = task.then(() => void 0, () => void 0);
    this.inFlight.add(tracked);
    try {
      return await task;
    } finally {
      this.inFlight.delete(tracked);
    }
  }
  async stop(handle) {
    try {
      handle.terminate();
      if (!await waitForQuiescence(handle, this.config.graceMs * 3)) throw new Error("not quiet");
      this.activeHandles.delete(handle);
    } catch {
      this.poisoned = true;
      throw new WhyAiCliError("WhyAI CLI process range could not be stopped within its shutdown deadline", "WHYAI_PROCESS_FAILED");
    }
  }
  acquire(signal) {
    if (signal.aborted) return Promise.reject(abortError(signal));
    if (this.poisoned) return Promise.reject(new WhyAiCliError("WhyAI CLI runner is unavailable after a process cleanup failure", "WHYAI_PROCESS_FAILED"));
    if (!this.busy) {
      this.busy = true;
      return Promise.resolve(this.releaseFactory());
    }
    return new Promise((resolve, reject) => {
      const waiter = {
        signal,
        resolve,
        reject,
        abort: () => {
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);
          reject(abortError(signal));
        }
      };
      signal.addEventListener("abort", waiter.abort, { once: true });
      this.waiters.push(waiter);
    });
  }
  releaseFactory() {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (this.poisoned) {
        for (const waiter2 of this.waiters.splice(0)) {
          waiter2.signal.removeEventListener("abort", waiter2.abort);
          waiter2.reject(new WhyAiCliError("WhyAI CLI runner is unavailable after a process cleanup failure", "WHYAI_PROCESS_FAILED"));
        }
        this.busy = false;
        return;
      }
      const waiter = this.waiters.shift();
      if (!waiter) {
        this.busy = false;
        return;
      }
      waiter.signal.removeEventListener("abort", waiter.abort);
      waiter.resolve(this.releaseFactory());
    };
  }
  async run(args, stdin, signal) {
    if (signal.aborted) throw abortError(signal);
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), this.config.timeoutMs);
    try {
      return await this.runWithDeadline(args, stdin, signal, timeout.signal);
    } finally {
      clearTimeout(timer);
    }
  }
  async runWithDeadline(args, stdin, signal, timeout) {
    const operationSignal = AbortSignal.any([signal, timeout]);
    let executable;
    try {
      executable = await untilAbort(this.subprocess.resolveExecutable(this.config.cliPath, void 0, operationSignal), operationSignal);
    } catch {
      if (operationSignal.aborted) throw abortError(signal, timeout);
      throw new WhyAiCliError("WhyAI CLI executable could not be resolved", "WHYAI_EXECUTABLE_NOT_FOUND");
    }
    if (operationSignal.aborted) throw abortError(signal, timeout);
    let handle;
    try {
      handle = this.subprocess.spawn({
        argv: [executable, ...args],
        cwd: this.cwd,
        stdio: {
          stdin: stdin === void 0 ? "ignore" : { data: stdin },
          stdout: { maxBytes: this.config.stdoutMaxBytes },
          stderr: { maxBytes: this.config.stderrMaxBytes }
        },
        graceMs: this.config.graceMs,
        signal: operationSignal
      });
    } catch {
      if (operationSignal.aborted) throw abortError(signal, timeout);
      throw new WhyAiCliError("WhyAI CLI could not start", "WHYAI_PROCESS_FAILED");
    }
    this.activeHandles.add(handle);
    let outcome;
    try {
      outcome = await untilAbort(handle.done, operationSignal);
    } catch {
      await this.stop(handle);
      if (operationSignal.aborted) throw abortError(signal, timeout);
      throw new WhyAiCliError("WhyAI CLI process failed", "WHYAI_PROCESS_FAILED");
    }
    let quiet = false;
    try {
      quiet = await waitForQuiescence(handle, this.config.graceMs);
    } catch {
      await this.stop(handle);
      if (operationSignal.aborted) throw abortError(signal, timeout);
      throw new WhyAiCliError("WhyAI CLI process range could not be observed within its shutdown grace", "WHYAI_PROCESS_FAILED");
    }
    if (!quiet) {
      await this.stop(handle);
      if (operationSignal.aborted) throw abortError(signal, timeout);
      throw new WhyAiCliError("WhyAI CLI process range exceeded its shutdown grace", "WHYAI_PROCESS_FAILED");
    }
    this.activeHandles.delete(handle);
    if (operationSignal.aborted) throw abortError(signal, timeout);
    const stdout = readComplete(handle.collected.stdout, "stdout").trim();
    const stderr = readComplete(handle.collected.stderr, "stderr").trim();
    if (outcome.signal !== null || outcome.exitCode === null) {
      throw new WhyAiCliError(`WhyAI CLI was terminated by ${outcome.signal ?? "an unknown signal"}`, "WHYAI_PROCESS_FAILED");
    }
    return { exitCode: outcome.exitCode, stdout, stderr };
  }
};
function cliFailure(invocation) {
  const info = invocation.error;
  return new WhyAiCliError(
    info?.message ?? `WhyAI CLI failed with exit code ${invocation.exitCode}`,
    info?.code === void 0 ? "WHYAI_COMMAND_FAILED" : String(info.code),
    info?.status
  );
}
function asRecord(value, label) {
  if (!isRecord(value)) throw new WhyAiCliError(`WhyAI CLI returned an invalid ${label}`, "WHYAI_MALFORMED_OUTPUT");
  return value;
}

// src/access.ts
var PUBLIC_CODES = /* @__PURE__ */ new Set([
  "WHYAI_NOT_LOGGED_IN",
  "WHYAI_QUOTA_EXHAUSTED",
  "WHYAI_ACCOUNT_DISABLED",
  "WHYAI_PAID_PLAN_REQUIRED",
  "WHYAI_COMMAND_FAILED",
  "WHYAI_PROCESS_FAILED",
  "WHYAI_EXECUTABLE_NOT_FOUND",
  "WHYAI_MALFORMED_OUTPUT",
  "WHYAI_OUTPUT_OVERFLOW",
  "WHYAI_TIMEOUT",
  "WHYAI_CANCELLED",
  "WHYAI_DISPOSED"
]);
function timestamp(value) {
  if (value === null || value === void 0) return null;
  if (typeof value !== "string" || value.length > 128 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new WhyAiCliError("Invalid billing timestamp", "WHYAI_MALFORMED_OUTPUT");
  }
  return value;
}
function project(value) {
  const data = asRecord(value, "billing access");
  const percent = data.available_percent ?? null;
  if (typeof data.eligible !== "boolean" || percent !== null && (typeof percent !== "number" || !Number.isFinite(percent) || percent < 0 || percent > 100)) {
    throw new WhyAiCliError("Invalid billing access fields", "WHYAI_MALFORMED_OUTPUT");
  }
  return { eligible: data.eligible, available_percent: percent, valid_until: timestamp(data.valid_until) };
}
function projectSummary(value) {
  const data = asRecord(value, "billing summary");
  if (data.plan_source !== void 0 && data.plan_source !== null && (typeof data.plan_source !== "string" || data.plan_source.length > 128)) {
    throw new WhyAiCliError("Invalid billing plan source", "WHYAI_MALFORMED_OUTPUT");
  }
  return {
    subscription_expires_at: data.plan_source === "subscription" ? timestamp(data.plan_expires_at) : null,
    next_reset_at: timestamp(data.next_reset_at),
    billing_status: "ok"
  };
}
var WhyAiAccess = class {
  constructor(runner) {
    this.runner = runner;
  }
  disposed = false;
  cache;
  flight;
  get() {
    if (this.disposed) return Promise.resolve({ status: "error", code: "WHYAI_DISPOSED" });
    if (this.cache && Date.now() < this.cache.expires) return Promise.resolve(this.cache.result);
    if (this.flight) return this.flight.promise;
    const controller = new AbortController();
    let settle;
    const promise = new Promise((resolve) => {
      settle = resolve;
    });
    let finished = false;
    let cancellation;
    const finish = (result) => {
      if (cancellation) result = { status: "error", code: cancellation };
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (!this.disposed) this.cache = { result: Object.freeze(result), expires: Date.now() + 3e4 };
      this.flight = void 0;
      settle(result);
    };
    const timer = setTimeout(() => {
      cancellation = "WHYAI_TIMEOUT";
      controller.abort();
    }, 1e4);
    this.flight = { promise, cancel: () => {
      cancellation = "WHYAI_DISPOSED";
      clearTimeout(timer);
      controller.abort();
    } };
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return void 0;
      return this.runner.invoke(["--json", "billing", "access"], void 0, controller.signal);
    }).then(async (invocation) => {
      if (cancellation || !invocation) {
        finish({ status: "error", code: cancellation ?? "WHYAI_CANCELLED" });
        return;
      }
      if (invocation.exitCode !== 0) throw cliFailure(invocation);
      const access = project(invocation.value);
      let billing;
      try {
        const summary = await this.runner.invoke(["--json", "billing", "summary"], void 0, controller.signal);
        if (summary.exitCode !== 0) throw cliFailure(summary);
        billing = projectSummary(summary.value);
      } catch (error) {
        if (cancellation) throw error;
        billing = { subscription_expires_at: null, next_reset_at: null, billing_status: "unavailable" };
      }
      finish({ status: "ok", data: Object.freeze({ ...access, ...billing }) });
    }).catch((error) => {
      const code = error instanceof WhyAiCliError && PUBLIC_CODES.has(error.code) ? error.code : "WHYAI_COMMAND_FAILED";
      finish({ status: "error", code });
    });
    return promise;
  }
  async dispose() {
    this.disposed = true;
    this.cache = void 0;
    const flight = this.flight;
    flight?.cancel();
    await flight?.promise;
  }
};

// src/routes.ts
function respond(res, status, result) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...status === 405 ? { Allow: "GET" } : {}
  });
  res.end(JSON.stringify(result));
}
function installAccessRoute(ctx, runner) {
  ctx.effect(() => {
    const access = new WhyAiAccess(runner);
    const remove = ctx.webServer.register({
      kind: "exact",
      path: "/api/whyai/access",
      handler: async (req, res) => {
        let rejection;
        try {
          rejection = ctx.connection.requestRejection(req);
        } catch {
          respond(res, 403, { status: "error", code: "WHYAI_FORBIDDEN" });
          return;
        }
        if (rejection !== void 0) {
          respond(res, rejection, { status: "error", code: rejection === 401 ? "WHYAI_UNAUTHORIZED" : "WHYAI_FORBIDDEN" });
          return;
        }
        if (req.method !== "GET") {
          respond(res, 405, { status: "error", code: "WHYAI_METHOD_NOT_ALLOWED" });
          return;
        }
        const result = await access.get();
        respond(res, result.status === "ok" ? 200 : result.code === "WHYAI_TIMEOUT" ? 504 : 503, result);
      }
    });
    return async () => {
      remove();
      await access.dispose();
    };
  }, "whyai: authenticated access route");
}

// src/tools.ts
var TOOL_NAMES = {
  status: "yai_status",
  partners: "yai_partners",
  create: "yai_conversation_create",
  send: "yai_message_send"
};
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactArgs(value, allowed, required) {
  if (!isRecord2(value)) throw new WhyAiCliError("tool arguments must be an object", "INVALID_ARGS");
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new WhyAiCliError(`unexpected argument ${key}`, "INVALID_ARGS");
  }
  for (const key of required) {
    if (!(key in value)) throw new WhyAiCliError(`missing required argument ${key}`, "INVALID_ARGS");
  }
  return value;
}
function text(value, name2, maxBytes) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new WhyAiCliError(`${name2} must be a non-empty string`, "INVALID_ARGS");
  }
  if (Buffer.byteLength(value, "utf8") > maxBytes) {
    throw new WhyAiCliError(`${name2} exceeds ${maxBytes} UTF-8 bytes`, "INVALID_ARGS");
  }
  return value;
}
function uuid(value, name2) {
  if (typeof value !== "string" || !UUID.test(value)) throw new WhyAiCliError(`${name2} must be a UUID`, "INVALID_ARGS");
  return value;
}
function optionalBoolean(value, name2) {
  if (value === void 0) return void 0;
  if (typeof value !== "boolean") throw new WhyAiCliError(`${name2} must be boolean`, "INVALID_ARGS");
  return value;
}
function requiredString(record, key, label) {
  if (typeof record[key] !== "string" || record[key].length === 0) {
    throw new WhyAiCliError(`WhyAI CLI returned an invalid ${label}`, "WHYAI_MALFORMED_OUTPUT");
  }
  return record[key];
}
function optionalString(record, key) {
  const value = record[key];
  if (value === void 0 || value === null) return void 0;
  if (typeof value !== "string" || value.length === 0) {
    throw new WhyAiCliError(`WhyAI CLI returned an invalid ${key}`, "WHYAI_MALFORMED_OUTPUT");
  }
  return value;
}
function requiredBoolean(record, key) {
  if (typeof record[key] !== "boolean") {
    throw new WhyAiCliError(`WhyAI CLI returned an invalid ${key}`, "WHYAI_MALFORMED_OUTPUT");
  }
  return record[key];
}
function optionalNumber(record, key) {
  const value = record[key];
  if (value === void 0 || value === null) return void 0;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new WhyAiCliError(`WhyAI CLI returned an invalid ${key}`, "WHYAI_MALFORMED_OUTPUT");
  }
  return value;
}
function warning(invocation) {
  return invocation.hadWarning ? ["WhyAI CLI reported a non-fatal warning; details were withheld."] : [];
}
function assertSuccess(invocation) {
  if (invocation.exitCode !== 0) throw cliFailure(invocation);
  return asRecord(invocation.value, "result");
}
function renderJson(value) {
  return [{ type: "text", text: JSON.stringify(value, null, 2) }];
}
function renderMessage(_args, value) {
  const result = value;
  const suffix = `

[YAI ${result.status}; conversation_id=${result.conversation_id}]`;
  return [{ type: "text", text: `${result.content}${suffix}` }];
}
var STATUS_OUTPUT = {
  type: "object",
  additionalProperties: false,
  required: ["cli_version", "logged_in", "warnings"],
  properties: {
    cli_version: { type: "string" },
    logged_in: { type: "boolean" },
    gateway: { type: "string" },
    environment: { type: "string" },
    access: { type: "object", additionalProperties: false, required: ["eligible"], properties: {
      eligible: { type: "boolean" },
      available_percent: { type: "number" },
      plan_code: { type: "string" },
      valid_until: { type: "string" },
      reason: { type: "string" }
    } },
    warnings: { type: "array", items: { type: "string" } }
  }
};
var PARTNERS_OUTPUT = {
  type: "object",
  additionalProperties: false,
  required: ["partners", "truncated", "warnings"],
  properties: {
    partners: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "name"], properties: {
      id: { type: "string" },
      name: { type: "string" },
      description: { type: "string" },
      tcpr_type: { type: "string" },
      tcpr_label: { type: "string" }
    } } },
    truncated: { type: "boolean" },
    warnings: { type: "array", items: { type: "string" } }
  }
};
var CONVERSATION_OUTPUT = {
  type: "object",
  additionalProperties: false,
  required: ["conversation_id", "partner_id", "warnings"],
  properties: {
    conversation_id: { type: "string" },
    partner_id: { type: "string" },
    model_id: { type: "string" },
    status: { type: "string" },
    warnings: { type: "array", items: { type: "string" } }
  }
};
var MESSAGE_OUTPUT = {
  type: "object",
  additionalProperties: false,
  required: ["status", "conversation_id", "content", "knowledge_base_requested", "warnings"],
  properties: {
    status: { type: "string", enum: ["completed", "partial"] },
    conversation_id: { type: "string" },
    content: { type: "string" },
    message_id: { type: "string" },
    model_id: { type: "string" },
    finish_reason: { type: "string" },
    knowledge_base_requested: { type: "boolean" },
    warnings: { type: "array", items: { type: "string" } }
  }
};
function createToolDefinitions(runner, config, logger) {
  const status = {
    name: TOOL_NAMES.status,
    description: "Check the local WhyAI CLI version, login state, and subscription access without exposing credentials.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
    output: { schema: STATUS_OUTPUT, render: (_args, value) => renderJson(value) },
    timeoutMs: config.timeoutMs,
    async execute(rawArgs, exec) {
      exactArgs(rawArgs, [], []);
      const version = await runner.version(exec.signal);
      const statusCall = await runner.invoke(["--json", "status"], void 0, exec.signal);
      const statusValue = assertSuccess(statusCall);
      const loggedIn = requiredBoolean(statusValue, "logged_in");
      const warnings = warning(statusCall);
      if (!loggedIn) return { cli_version: version, logged_in: false, warnings };
      const accessCall = await runner.invoke(["--json", "billing", "access"], void 0, exec.signal);
      const accessValue = assertSuccess(accessCall);
      warnings.push(...warning(accessCall));
      const gateway = optionalString(statusValue, "gateway");
      const environment = optionalString(statusValue, "environment");
      const availablePercent = optionalNumber(accessValue, "available_percent");
      if (availablePercent !== void 0 && (availablePercent < 0 || availablePercent > 100)) {
        throw new WhyAiCliError("WhyAI CLI returned available_percent outside 0..100", "WHYAI_MALFORMED_OUTPUT");
      }
      const planCode = optionalString(accessValue, "plan_code");
      const validUntil = optionalString(accessValue, "valid_until");
      const reason = optionalString(accessValue, "reason");
      return {
        cli_version: version,
        logged_in: true,
        ...gateway === void 0 ? {} : { gateway },
        ...environment === void 0 ? {} : { environment },
        access: {
          eligible: requiredBoolean(accessValue, "eligible"),
          ...availablePercent === void 0 ? {} : { available_percent: availablePercent },
          ...planCode === void 0 ? {} : { plan_code: planCode },
          ...validUntil === void 0 ? {} : { valid_until: validUntil },
          ...reason === void 0 ? {} : { reason }
        },
        warnings
      };
    }
  };
  const partners = {
    name: TOOL_NAMES.partners,
    description: "Find currently available official WhyAI Partners by topic. Returns stable Partner ids for later calls; do not put confidential data in the query.",
    parameters: { type: "object", additionalProperties: false, required: ["query"], properties: {
      query: { type: "string", description: "Short non-confidential topic, such as \u4E94\u6B65\u6CD5 or ROI." },
      type: { type: "string", enum: ["T", "C", "P", "R"] },
      limit: { type: "integer", minimum: 1, maximum: 50 }
    } },
    output: { schema: PARTNERS_OUTPUT, render: (_args, value) => renderJson(value) },
    timeoutMs: config.timeoutMs,
    async execute(rawArgs, exec) {
      const args = exactArgs(rawArgs, ["query", "type", "limit"], ["query"]);
      const query = text(args.query, "query", 512);
      const type = args.type === void 0 ? void 0 : text(args.type, "type", 1);
      if (type !== void 0 && !["T", "C", "P", "R"].includes(type)) throw new WhyAiCliError("type must be T, C, P, or R", "INVALID_ARGS");
      const limit = args.limit === void 0 ? config.partnerLimit : args.limit;
      if (!Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > 50) throw new WhyAiCliError("limit must be an integer from 1 to 50", "INVALID_ARGS");
      const command = ["--json", "partners", "search", query, "--scope", "official"];
      if (type !== void 0) command.push("--type", type);
      const invocation = await runner.invoke(command, void 0, exec.signal);
      if (invocation.hadWarning) logger.warn("[whyai] partner search completed with a CLI warning");
      if (invocation.exitCode !== 0) throw cliFailure(invocation);
      if (!Array.isArray(invocation.value)) throw new WhyAiCliError("WhyAI CLI returned an invalid Partner list", "WHYAI_MALFORMED_OUTPUT");
      const parsed = invocation.value.map((item) => {
        const record = asRecord(item, "Partner");
        return {
          id: uuid(record.id, "Partner id"),
          name: requiredString(record, "name", "Partner name"),
          ...optionalString(record, "description") ? { description: optionalString(record, "description") } : {},
          ...optionalString(record, "tcpr_type") ? { tcpr_type: optionalString(record, "tcpr_type") } : {},
          ...optionalString(record, "tcpr_label") ? { tcpr_label: optionalString(record, "tcpr_label") } : {}
        };
      });
      return { partners: parsed.slice(0, Number(limit)), truncated: parsed.length > Number(limit), warnings: warning(invocation) };
    }
  };
  const create = {
    name: TOOL_NAMES.create,
    description: "Create a WhyAI Partner conversation. This writes to an external service but sends no message; use the returned conversation_id with yai_message_send.",
    parameters: { type: "object", additionalProperties: false, required: ["partner_id"], properties: {
      partner_id: { type: "string", description: "Partner UUID returned by yai_partners." },
      title: { type: "string", description: "Optional non-sensitive conversation title." }
    } },
    output: { schema: CONVERSATION_OUTPUT, render: (_args, value) => renderJson(value) },
    timeoutMs: config.timeoutMs,
    async execute(rawArgs, exec) {
      const args = exactArgs(rawArgs, ["partner_id", "title"], ["partner_id"]);
      const partnerId = uuid(args.partner_id, "partner_id");
      const title = args.title === void 0 ? void 0 : text(args.title, "title", 1024);
      const payload = JSON.stringify({ partner_id: partnerId, ...title === void 0 ? {} : { title } });
      const invocation = await runner.invoke(["--json", "conversations", "create", "--data", "-"], payload, exec.signal);
      const value = assertSuccess(invocation);
      const returnedPartnerId = uuid(value.partner_id, "Partner id");
      if (returnedPartnerId !== partnerId) {
        throw new WhyAiCliError("WhyAI CLI returned a conversation for a different Partner", "WHYAI_RESPONSE_MISMATCH");
      }
      const modelId = optionalString(value, "model_id");
      const status2 = optionalString(value, "status");
      return {
        conversation_id: uuid(value.id, "conversation id"),
        partner_id: returnedPartnerId,
        ...modelId === void 0 ? {} : { model_id: modelId },
        ...status2 === void 0 ? {} : { status: status2 },
        warnings: warning(invocation)
      };
    }
  };
  const send = {
    name: TOOL_NAMES.send,
    description: "Send explicit text to an existing WhyAI conversation. This transmits data to an external, potentially billable service. Never send code, files, credentials, or private data unless the user explicitly authorizes that content.",
    parameters: { type: "object", additionalProperties: false, required: ["conversation_id", "message"], properties: {
      conversation_id: { type: "string", description: "Conversation UUID returned by yai_conversation_create." },
      message: { type: "string", description: "Only the explicit, reviewed text to send to WhyAI." },
      knowledge_base: { type: "boolean", description: "Ask WhyAI to enable its knowledge base for this message." },
      use_memory: { type: "boolean", description: "Allow WhyAI account memory. Defaults to false." }
    } },
    output: { schema: MESSAGE_OUTPUT, render: renderMessage },
    timeoutMs: config.timeoutMs,
    async execute(rawArgs, exec) {
      const args = exactArgs(rawArgs, ["conversation_id", "message", "knowledge_base", "use_memory"], ["conversation_id", "message"]);
      const conversationId = uuid(args.conversation_id, "conversation_id");
      const message = text(args.message, "message", config.promptMaxBytes);
      const knowledgeBase = optionalBoolean(args.knowledge_base, "knowledge_base") === true;
      const useMemory = optionalBoolean(args.use_memory, "use_memory") === true;
      const command = ["--json", "chat", "-", "--conversation", conversationId];
      if (knowledgeBase) command.push("--knowledge-base");
      if (!useMemory) command.push("--no-memory");
      const invocation = await runner.invoke(command, message, exec.signal);
      if (!isRecord2(invocation.value)) {
        if (invocation.exitCode !== 0) throw cliFailure(invocation);
        throw new WhyAiCliError("WhyAI CLI returned an invalid chat result", "WHYAI_MALFORMED_OUTPUT");
      }
      const value = invocation.value;
      const partial = invocation.exitCode !== 0 && typeof value.conversation_id === "string" && typeof value.content === "string";
      if (invocation.exitCode !== 0 && !partial) throw cliFailure(invocation);
      if (typeof value.content !== "string") {
        throw new WhyAiCliError("WhyAI CLI returned chat content with an invalid type", "WHYAI_MALFORMED_OUTPUT");
      }
      const returnedConversationId = uuid(value.conversation_id, "conversation id");
      if (returnedConversationId !== conversationId) {
        throw new WhyAiCliError("WhyAI CLI returned a response for a different conversation", "WHYAI_RESPONSE_MISMATCH");
      }
      const messageId = optionalString(value, "message_id");
      const modelId = optionalString(value, "model_id");
      const finishReason = optionalString(value, "finish_reason");
      return {
        status: partial ? "partial" : "completed",
        conversation_id: returnedConversationId,
        content: value.content,
        ...messageId === void 0 ? {} : { message_id: messageId },
        ...modelId === void 0 ? {} : { model_id: modelId },
        ...finishReason === void 0 ? {} : { finish_reason: finishReason },
        knowledge_base_requested: knowledgeBase,
        warnings: [...warning(invocation), ...partial ? ["WhyAI returned a partial response; remote persistence may be incomplete."] : []]
      };
    }
  };
  return [status, partners, create, send];
}

// src/index.ts
var name = "whyai";
var inject = ["tools", "subprocess"];
var MUTATING_TOOLS = /* @__PURE__ */ new Set([TOOL_NAMES.create, TOOL_NAMES.send]);
function apply(ctx, config) {
  validateConfig(config);
  const runner = new WhyAiCliRunner(ctx.subprocess, config);
  for (const tool of createToolDefinitions(runner, config, ctx.logger)) ctx.tools.register(tool);
  ctx.inject(["webServer", "connection"], (webCtx) => installAccessRoute(webCtx, runner));
  if (config.requireApproval) {
    ctx.on("tools/pre-execute", async (exec, next) => {
      const prior = await next();
      if (prior.kind !== "allow" || !MUTATING_TOOLS.has(exec.name)) return prior;
      return {
        kind: "ask",
        reason: exec.name === TOOL_NAMES.send ? "This sends explicit text to the external WhyAI service and may consume paid quota." : "This creates a conversation on the external WhyAI service."
      };
    });
  }
  ctx.effect(() => async () => {
    await runner.dispose();
  }, "whyai: stop CLI calls");
}
export {
  Config,
  TOOL_NAMES,
  WhyAiCliError,
  WhyAiCliRunner,
  apply,
  createToolDefinitions,
  inject,
  name
};
