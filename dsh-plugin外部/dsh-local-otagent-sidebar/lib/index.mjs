import z from "@deepseek-ai/schemastery";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
// src/config.ts
const workspaceDir = process.cwd();
process.execPath;
const openclawEntry = "/home/aaronmy/.nvm/versions/node/v22.22.3/lib/node_modules/openclaw/dist/index.js";
const openclawNodeBin = process.env.OPENCLAW_NODE_BIN ?? "/home/aaronmy/.nvm/versions/node/v22.22.3/bin/node";
const AgentDefSchema = z.object({
	id: z.string(),
	displayName: z.string(),
	command: z.string(),
	args: z.array(z.string()).default([]),
	env: z.dict(z.string()).default({}),
	cwd: z.string().default(workspaceDir),
	enabled: z.boolean().default(true)
});
const Config = z.object({
	agents: z.array(AgentDefSchema).default([{
		id: "hermes",
		displayName: "hermes",
		command: "/home/aaronmy/.local/bin/hermes",
		args: ["acp"],
		cwd: workspaceDir,
		enabled: true
	}, {
		id: "openclaw",
		displayName: "openclaw",
		command: openclawNodeBin,
		args: [
			openclawEntry,
			"acp",
			"--url",
			"ws://127.0.0.1:18789"
		],
		cwd: workspaceDir,
		enabled: true
	}]),
	maxSessionsPerAgent: z.number().default(20),
	initTimeoutMs: z.number().default(3e4),
	idleTimeoutMs: z.number().default(3e5),
	permissionPolicy: z.union([
		z.const("auto-allow"),
		z.const("ask"),
		z.const("deny")
	]).default("auto-allow"),
	permissionTimeoutMs: z.number().default(3e4),
	collab: z.object({
		enabled: z.boolean().default(true),
		mode: z.union([z.const("handoff-only"), z.const("auto-host")]).default("auto-host")
	}).default({}),
	upload: z.object({
		maxBytes: z.number().default(20971520),
		ttlMs: z.number().default(36e5)
	}).default({})
});
Config({});
function dataDir() {
	const home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
	return join(home, "otagent");
}
// src/store.ts
var SessionStore = class {
	dir;
	manifestPath;
	messagesDir;
	queue = Promise.resolve();
	constructor(dataDir) {
		this.dir = resolve(dataDir);
		this.manifestPath = join(this.dir, "sessions.json");
		this.messagesDir = join(this.dir, "messages");
	}
	async readManifest() {
		try {
			const raw = await readFile(this.manifestPath, "utf8");
			const parsed = JSON.parse(raw);
			return { sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [] };
		} catch {
			return { sessions: [] };
		}
	}
	async writeManifest(m) {
		await mkdir(this.dir, { recursive: true });
		const tmp = this.manifestPath + ".tmp";
		await writeFile(tmp, JSON.stringify(m, null, 2), "utf8");
		await rename(tmp, this.manifestPath);
	}
	/** Serialize all read-modify-write cycles on the manifest. */
	transact(fn) {
		const run = this.queue.then(async () => {
			const m = await this.readManifest();
			const result = await fn(m);
			await this.writeManifest(m);
			return result;
		});
		this.queue = run.catch(() => void 0);
		return run;
	}
	messagePath(id) {
		const encoded = encodeURIComponent(id);
		const p = resolve(this.messagesDir, encoded + ".jsonl");
		if (p !== this.messagesDir && !p.startsWith(this.messagesDir + sep)) throw new Error(`unsafe session id: ${id}`);
		return p;
	}
	async listSessions(agentId) {
		return (await this.readManifest()).sessions.filter((s) => s.agentId === agentId && s.state !== "closed");
	}
	async getSession(id) {
		return (await this.readManifest()).sessions.find((s) => s.id === id);
	}
	async createSession(agentId, acpSessionId, cwd, title = "New session") {
		const now = Date.now();
		const rec = {
			id: `${agentId}:${randomUUID()}`,
			agentId,
			acpSessionId,
			cwd,
			title,
			state: "idle",
			createdAt: now,
			updatedAt: now
		};
		await this.transact((m) => {
			m.sessions.push(rec);
		});
		return rec;
	}
	async renameSession(id, title) {
		await this.transact((m) => {
			const s = m.sessions.find((x) => x.id === id);
			if (s) {
				s.title = title;
				s.updatedAt = Date.now();
			}
		});
	}
	async setState(id, state) {
		await this.transact((m) => {
			const s = m.sessions.find((x) => x.id === id);
			if (s) {
				s.state = state;
				s.updatedAt = Date.now();
			}
		});
	}
	async closeSession(id) {
		await this.setState(id, "closed");
	}
	async appendMessage(id, msg) {
		await mkdir(this.messagesDir, { recursive: true });
		await appendFile(this.messagePath(id), JSON.stringify(msg) + "\n", "utf8");
	}
	async recentMessages(id, n) {
		let raw;
		try {
			raw = await readFile(this.messagePath(id), "utf8");
		} catch {
			return [];
		}
		return raw.split("\n").filter(Boolean).slice(-n).map((line) => JSON.parse(line));
	}
};
// src/acp-connection.ts
/** Copy process.env, strip the OpenClaw token trap, then overlay def.env. */
function buildSpawnEnv(def) {
	const env = {};
	for (const [k, v] of Object.entries(process.env)) if (v !== void 0) env[k] = v;
	if (def.id === "openclaw") delete env.OPENCLAW_GATEWAY_TOKEN;
	if (def.env) Object.assign(env, def.env);
	return env;
}
var AcpConnection = class {
	def;
	state = "new";
	capabilities;
	opts;
	child;
	conn;
	readyPromise;
	constructor(def, opts) {
		this.def = def;
		this.opts = opts;
	}
	/** Idempotent: spawn + ndjson stream + initialize, guarded by initTimeoutMs. */
	ready() {
		if (this.readyPromise) return this.readyPromise;
		this.state = "initializing";
		this.readyPromise = this.doInitialize().catch((err) => {
			this.state = "dead";
			this.readyPromise = void 0;
			throw err;
		});
		return this.readyPromise;
	}
	async doInitialize() {
		const child = spawn(this.def.command, this.def.args, {
			cwd: this.def.cwd,
			env: buildSpawnEnv(this.def),
			stdio: [
				"pipe",
				"pipe",
				"pipe"
			]
		});
		this.child = child;
		let rejectSpawn;
		const spawnError = new Promise((_resolve, reject) => {
			rejectSpawn = reject;
		});
		const onSpawnError = (err) => {
			this.state = "dead";
			rejectSpawn(err);
			try {
				this.opts.onExit(err);
			} catch {}
		};
		child.on("error", onSpawnError);
		child.stdin.on("error", onSpawnError);
		child.stdout.on("error", onSpawnError);
		child.stderr.on("error", onSpawnError);
		child.stderr.on("data", () => {});
		child.on("exit", () => {
			this.state = "dead";
			this.opts.onExit();
		});
		const stream = acp.ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout));
		const client = {
			sessionUpdate: (params) => {
				this.opts.onUpdate(params);
			},
			requestPermission: (params) => this.opts.onPermission(params)
		};
		const conn = new acp.ClientSideConnection(() => client, stream);
		this.conn = conn;
		let timer;
		const timeout = new Promise((_resolve, reject) => {
			timer = setTimeout(() => {
				reject(/* @__PURE__ */ new Error(`ACP initialize timed out after ${this.opts.initTimeoutMs}ms`));
				child.kill();
				this.conn = void 0;
			}, this.opts.initTimeoutMs);
			timer.unref?.();
		});
		try {
			const init = await Promise.race([
				conn.initialize({
					protocolVersion: acp.PROTOCOL_VERSION,
					clientCapabilities: {},
					clientInfo: {
						name: "dsh-local-otagent-sidebar",
						version: "0.1.0"
					}
				}),
				timeout,
				spawnError
			]);
			this.capabilities = init.agentCapabilities;
			this.state = "ready";
		} finally {
			clearTimeout(timer);
		}
	}
	async connection() {
		await this.ready();
		if (!this.conn) throw new Error("ACP connection not established");
		return this.conn;
	}
	async newSession(cwd) {
		return (await (await this.connection()).newSession({
			cwd,
			mcpServers: []
		})).sessionId;
	}
	async loadSession(sessionId, cwd) {
		await (await this.connection()).loadSession({
			sessionId,
			cwd,
			mcpServers: []
		});
	}
	async listSessions() {
		return (await (await this.connection()).listSessions({})).sessions ?? [];
	}
	async prompt(sessionId, blocks) {
		return (await this.connection()).prompt({
			sessionId,
			prompt: blocks
		});
	}
	async cancel(sessionId) {
		await (await this.connection()).cancel({ sessionId });
	}
	async closeSession(sessionId) {
		await (await this.connection()).closeSession({ sessionId });
	}
	async dispose() {
		this.state = "dead";
		this.readyPromise = void 0;
		this.conn = void 0;
		if (this.child && !this.child.killed) this.child.kill();
		this.child = void 0;
	}
};
// src/attachment-map.ts
const TEXT_INLINE_MAX = 65536;
const IMAGE_MIME = /^image\//;
/**
* Map uploaded refs into ACP content blocks according to agent capability.
* - openclaw: images become real `image` blocks (base64); small text files are
*   inlined as `resource` text; everything else is a `resource_link`.
* - hermes (and unknown agents): references are ALWAYS a text line
*   `[附件] name -> absPath` — the adapter ignores non-text blocks (P-04), so
*   promising a visual upload would be a lie.
* The user text is appended as the final text block.
*/
function mapAttachments(agentId, refs, userText) {
	const blocks = [];
	if (agentId === "openclaw") for (const ref of refs) if (IMAGE_MIME.test(ref.mime)) blocks.push(makeImageBlock(ref));
	else if (isTextLike(ref)) blocks.push(makeResourceBlock(ref));
	else blocks.push(makeLinkBlock(ref));
	else for (const ref of refs) blocks.push({
		type: "text",
		text: `[附件] ${ref.name} → ${ref.absPath}`
	});
	if (userText) blocks.push({
		type: "text",
		text: userText
	});
	return blocks;
}
function isTextLike(ref) {
	return /^text\//.test(ref.mime) || /json|yaml|xml|javascript|csv|markdown/.test(ref.mime) || /\.(txt|md|json|ya?ml|xml|csv|log|ts|js|py)$/i.test(ref.name);
}
function makeImageBlock(ref) {
	return {
		type: "image",
		data: ref.base64 ?? "",
		mimeType: ref.mime
	};
}
function makeResourceBlock(ref) {
	const text = ref.text ?? "";
	return {
		type: "resource",
		resource: {
			uri: `file://${ref.absPath}`,
			mimeType: ref.mime,
			text
		}
	};
}
function makeLinkBlock(ref) {
	return {
		type: "resource_link",
		uri: `file://${ref.absPath}`,
		name: ref.name,
		mimeType: ref.mime
	};
}
/** Load file payloads onto refs so mapAttachments stays sync and testable. */
async function hydrateRefs(refs) {
	const out = [];
	for (const ref of refs) {
		const data = await readFile(ref.absPath);
		if (IMAGE_MIME.test(ref.mime)) out.push({
			...ref,
			base64: data.toString("base64")
		});
		else if (isTextLike(ref) && ref.size <= TEXT_INLINE_MAX) out.push({
			...ref,
			text: data.toString("utf8")
		});
		else out.push(ref);
	}
	return out;
}
// src/manager.ts
var OtAgentManager = class {
	config;
	store;
	hooks;
	agents = /* @__PURE__ */ new Map();
	/** per-session tail promise for strict serialization */
	queues = /* @__PURE__ */ new Map();
	disposed = false;
	constructor(config, store, hooks) {
		this.config = config;
		this.store = store;
		this.hooks = hooks;
	}
	agentDef(agentId) {
		const def = this.config.agents.find((a) => a.id === agentId);
		if (!def) throw new Error(`unknown agent: ${agentId}`);
		return def;
	}
	async entry(agentId) {
		let e = this.agents.get(agentId);
		if (e) return e;
		const def = this.agentDef(agentId);
		const opts = {
			initTimeoutMs: this.config.initTimeoutMs,
			onUpdate: (n) => this.onUpdate(agentId, n),
			onPermission: (p) => this.onPermission(agentId, p),
			onExit: () => this.onExit(agentId)
		};
		const conn = this.hooks.connectionFactory ? this.hooks.connectionFactory(def, opts) : new AcpConnection(def, opts);
		e = {
			conn,
			sessions: /* @__PURE__ */ new Map()
		};
		this.agents.set(agentId, e);
		try {
			await conn.ready();
			const records = await this.store.listSessions(agentId);
			for (const r of records) try {
				await conn.loadSession(r.acpSessionId, r.cwd);
				e.sessions.set(r.id, r.acpSessionId);
				this.store.setState(r.id, "idle");
			} catch {
				this.store.setState(r.id, "reconnecting");
			}
		} catch (err) {
			this.agents.delete(agentId);
			await conn.dispose();
			throw err;
		}
		return e;
	}
	/** Translate an ACP sessionId back to the plugin's own session id, then fan out only to it. */
	onUpdate(agentId, n) {
		const e = this.agents.get(agentId);
		let pluginId;
		if (e && n.sessionId) {
			for (const [pid, aid] of e.sessions) if (aid === n.sessionId) {
				pluginId = pid;
				break;
			}
		}
		if (pluginId) this.hooks.broadcast(pluginId, {
			type: "update",
			sessionId: pluginId,
			payload: n
		});
	}
	onPermission(agentId, p) {
		const e = this.agents.get(agentId);
		let pluginId = "";
		if (e && p.sessionId) {
			for (const [pid, aid] of e.sessions) if (aid === p.sessionId) {
				pluginId = pid;
				break;
			}
		}
		return this.hooks.requestPermission(pluginId, p);
	}
	onExit(agentId) {
		const e = this.agents.get(agentId);
		if (!e || this.disposed) return;
		for (const pid of e.sessions.keys()) this.store.setState(pid, "reconnecting");
	}
	resetIdle(agentId) {
		const e = this.agents.get(agentId);
		if (!e) return;
		if (e.idleTimer) clearTimeout(e.idleTimer);
		e.idleTimer = setTimeout(() => {
			e.idleTimer = void 0;
			if (this.disposed) return;
			this.maybeReclaim(agentId);
		}, this.config.idleTimeoutMs);
		e.idleTimer.unref?.();
	}
	async maybeReclaim(agentId) {
		const e = this.agents.get(agentId);
		if (!e || this.disposed) return;
		if ((await this.store.listSessions(agentId)).some((r) => r.state === "running")) return;
		await e.conn.dispose();
		this.agents.delete(agentId);
	}
	async listAgents() {
		return this.config.agents.filter((a) => a.enabled).map((a) => ({
			id: a.id,
			displayName: a.displayName,
			state: this.agents.has(a.id) ? "ready" : "new"
		}));
	}
	async listSessions(agentId) {
		return this.store.listSessions(agentId);
	}
	async createSession(agentId, cwd) {
		if ((await this.store.listSessions(agentId)).length >= this.config.maxSessionsPerAgent) throw new Error(`maxSessionsPerAgent (${this.config.maxSessionsPerAgent}) reached for ${agentId}`);
		const e = await this.entry(agentId);
		const def = this.agentDef(agentId);
		const workdir = cwd ?? def.cwd;
		const acpSessionId = await e.conn.newSession(workdir);
		const rec = await this.store.createSession(agentId, acpSessionId, workdir);
		e.sessions.set(rec.id, acpSessionId);
		this.resetIdle(agentId);
		return rec;
	}
	/**
	* Claim a queue slot SYNCHRONOUSLY at call time: chain the new task off the
	* previous tail before any `await`. The async prelude (store read, connection
	* setup) inside `task` cannot reorder callers, because the chain is already
	* fixed. Returns the queued promise.
	*/
	enqueue(sessionId, task) {
		const run = (this.queues.get(sessionId) ?? Promise.resolve()).catch(() => void 0).then(task);
		this.queues.set(sessionId, run.catch(() => void 0));
		return run;
	}
	async sendPrompt(sessionId, blocks, _originDeviceId, attachmentRefs) {
		return this.enqueue(sessionId, async () => {
			const rec = await this.store.getSession(sessionId);
			if (!rec || rec.state === "closed") throw new Error(`session not found: ${sessionId}`);
			const e = await this.entry(rec.agentId);
			const acpId = e.sessions.get(sessionId) ?? rec.acpSessionId;
			let effective = blocks;
			if (attachmentRefs?.length) {
				const refs = await hydrateRefs(attachmentRefs);
				const userText = blocks.map((b) => b.type === "text" ? b.text : "").filter(Boolean).join("\n");
				effective = mapAttachments(rec.agentId, refs, userText);
			}
			await this.store.setState(sessionId, "running");
			const msg = {
				role: "user",
				text: blocks.map((b) => b.type === "text" ? b.text : "").filter(Boolean).join("\n"),
				at: Date.now(),
				attachmentRefs
			};
			await this.store.appendMessage(sessionId, msg);
			try {
				await e.conn.prompt(acpId, effective);
				await this.store.setState(sessionId, "idle");
				this.resetIdle(rec.agentId);
			} catch (err) {
				await this.store.setState(sessionId, "idle");
				this.hooks.broadcast(sessionId, {
					type: "error",
					sessionId,
					payload: String(err)
				});
				throw err;
			}
		});
	}
	async cancelSession(sessionId) {
		const rec = await this.store.getSession(sessionId);
		if (!rec) return;
		const e = this.agents.get(rec.agentId);
		if (e) await e.conn.cancel(e.sessions.get(sessionId) ?? rec.acpSessionId);
	}
	async renameSession(sessionId, title) {
		await this.store.renameSession(sessionId, title);
	}
	async getMessages(sessionId) {
		return this.store.recentMessages(sessionId, 1e3);
	}
	async closeSession(sessionId) {
		const rec = await this.store.getSession(sessionId);
		if (!rec) return;
		const e = this.agents.get(rec.agentId);
		if (e) {
			await e.conn.closeSession(e.sessions.get(sessionId) ?? rec.acpSessionId);
			e.sessions.delete(sessionId);
		}
		await this.store.closeSession(sessionId);
	}
	/** Semi-automatic collaboration: carry recent context into a new target session. */
	async handoff(sourceSessionId, targetAgentId) {
		const context = (await this.store.recentMessages(sourceSessionId, 10)).map((m) => `${m.role}: ${m.text}`).join("\n");
		const target = await this.createSession(targetAgentId);
		const prompt = `[shared-context]\n${context}\n[/shared-context]\nContinue the task above.`;
		await this.sendPrompt(target.id, [{
			type: "text",
			text: prompt
		}]);
		return target;
	}
	async dispose() {
		this.disposed = true;
		for (const e of this.agents.values()) {
			if (e.idleTimer) clearTimeout(e.idleTimer);
			await e.conn.dispose();
		}
		this.agents.clear();
		this.queues.clear();
	}
};
// src/upload.ts
/** Neutralize path separators and traversal sequences in a client filename. */
function safeUploadName(name) {
	return name.replace(/[\\/]/g, "_");
}
async function readBody$1(req, maxBytes) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const b = chunk;
		size += b.length;
		if (size > maxBytes) throw new Error("payload too large");
		chunks.push(b);
	}
	return Buffer.concat(chunks);
}
function respond$1(res, status, data) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(data));
}
/**
* Store an uploaded file under `<uploadRoot>/<refId>-<safeName>`.
* Headers: x-filename, x-mime (optional), x-session-id (required).
*/
async function handleUpload(uploadRoot, maxBytes, req, res) {
	const root = resolve(uploadRoot);
	const headers = req.headers;
	const session = Array.isArray(headers["x-session-id"]) ? headers["x-session-id"][0] : headers["x-session-id"];
	if (!session) {
		respond$1(res, 400, { error: "missing x-session-id" });
		return;
	}
	const rawName = Array.isArray(headers["x-filename"]) ? headers["x-filename"][0] : headers["x-filename"];
	if (!rawName) {
		respond$1(res, 400, { error: "missing x-filename" });
		return;
	}
	let body;
	try {
		body = await readBody$1(req, maxBytes);
	} catch (err) {
		respond$1(res, 413, { error: String(err) });
		return;
	}
	const refId = randomUUID();
	const name = safeUploadName(rawName);
	const dir = resolve(root, session);
	const absPath = resolve(dir, `${refId}-${name}`);
	if (!absPath.startsWith(root + sep)) {
		respond$1(res, 400, { error: "unsafe path" });
		return;
	}
	await mkdir(dir, { recursive: true });
	await writeFile(absPath, body);
	respond$1(res, 200, { ref: {
		refId,
		name,
		mime: (Array.isArray(headers["x-mime"]) ? headers["x-mime"][0] : headers["x-mime"]) ?? "application/octet-stream",
		size: body.length,
		absPath,
		sessionId: String(session)
	} });
}
// src/routes.ts
const MAX_BODY = 1048576;
function respond(res, status, data) {
	const body = JSON.stringify(data);
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(body);
}
async function readBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const b = chunk;
		size += b.length;
		if (size > MAX_BODY) throw new Error("body too large");
		chunks.push(b);
	}
	const raw = Buffer.concat(chunks).toString("utf8");
	if (!raw) return {};
	return JSON.parse(raw);
}
/** Parse `/api/otagent/sessions/<encoded id>/<action>` from a prefix route. */
function parseSessionPath(url) {
	const prefix = "/api/otagent/sessions/";
	const q = url.indexOf("?");
	const pathname = q >= 0 ? url.slice(0, q) : url;
	if (!pathname.startsWith(prefix)) return void 0;
	const rest = pathname.slice(22);
	const slash = rest.lastIndexOf("/");
	if (slash < 0) return void 0;
	return {
		id: decodeURIComponent(rest.slice(0, slash)),
		action: rest.slice(slash + 1)
	};
}
function installRoutes(ctx, manager, _config, hub, extras) {
	const disposers = [];
	/** Wrap every handler with the host's request gate (dshmarket routes.js:2425). */
	const register = (kind, path, handler) => {
		const guarded = async (req, res) => {
			let rejection;
			try {
				rejection = ctx.connection.requestRejection(req);
			} catch {
				respond(res, 403, { error: "forbidden" });
				return;
			}
			if (rejection !== void 0) {
				respond(res, rejection, { error: "forbidden" });
				return;
			}
			await handler(req, res);
		};
		disposers.push(ctx.webServer.register({
			kind,
			path,
			handler: guarded
		}));
	};
	register("exact", "/api/otagent/agents", async (req, res) => {
		if (req.method !== "GET") {
			respond(res, 405, { error: "method not allowed" });
			return;
		}
		respond(res, 200, { agents: await manager.listAgents() });
	});
	register("exact", "/api/otagent/sessions", async (req, res) => {
		if (req.method === "GET") {
			const q = (req.url ?? "").split("?")[1] ?? "";
			const agent = new URLSearchParams(q).get("agent") ?? "";
			respond(res, 200, { sessions: await manager.listSessions(agent) });
			return;
		}
		if (req.method === "POST") {
			let body;
			try {
				body = await readBody(req);
			} catch {
				respond(res, 400, { error: "invalid body" });
				return;
			}
			const agentId = String(body.agentId ?? "");
			const cwd = body.cwd ? String(body.cwd) : void 0;
			try {
				respond(res, 201, { session: await manager.createSession(agentId, cwd) });
			} catch (err) {
				respond(res, 400, { error: String(err) });
			}
			return;
		}
		respond(res, 405, { error: "method not allowed" });
	});
	register("exact", "/api/otagent/handoff", async (req, res) => {
		if (req.method !== "POST") {
			respond(res, 405, { error: "method not allowed" });
			return;
		}
		let body;
		try {
			body = await readBody(req);
		} catch {
			respond(res, 400, { error: "invalid body" });
			return;
		}
		try {
			respond(res, 201, { session: await manager.handoff(String(body.sourceSessionId ?? ""), String(body.targetAgentId ?? "")) });
		} catch (err) {
			respond(res, 400, { error: String(err) });
		}
	});
	if (hub) register("exact", "/api/otagent/stream", async (req, res) => {
		if (req.method !== "GET") {
			respond(res, 405, { error: "method not allowed" });
			return;
		}
		const q = (req.url ?? "").split("?")[1] ?? "";
		const ids = (new URLSearchParams(q).get("session") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
		const unsub = hub.subscribe(res, ids);
		req.on("close", unsub);
	});
	if (extras) {
		const { uploadRoot, uploadMaxBytes } = extras;
		register("exact", "/api/otagent/upload", async (req, res) => {
			if (req.method !== "POST") {
				respond(res, 405, { error: "method not allowed" });
				return;
			}
			await handleUpload(uploadRoot, uploadMaxBytes, req, res);
		});
	}
	register("prefix", "/api/otagent/sessions", async (req, res) => {
		const parsed = parseSessionPath(req.url ?? "");
		if (!parsed) {
			respond(res, 405, { error: "method not allowed" });
			return;
		}
		if (parsed.action === "messages") {
			if (req.method !== "GET") {
				respond(res, 405, { error: "method not allowed" });
				return;
			}
			try {
				respond(res, 200, { messages: await manager.getMessages(parsed.id) });
			} catch (err) {
				respond(res, 404, { error: String(err) });
			}
			return;
		}
		if (parsed.action === "rename") {
			if (req.method !== "POST") {
				respond(res, 405, { error: "method not allowed" });
				return;
			}
			let body;
			try {
				body = await readBody(req);
			} catch {
				respond(res, 400, { error: "invalid body" });
				return;
			}
			try {
				await manager.renameSession(parsed.id, String(body.title ?? ""));
				respond(res, 200, { ok: true });
			} catch (err) {
				respond(res, 400, { error: String(err) });
			}
			return;
		}
		if (req.method === "POST" && (parsed.action === "prompt" || parsed.action === "cancel" || parsed.action === "close")) {
			try {
				if (parsed.action === "prompt") {
					const body = await readBody(req);
					const blocks = body.blocks ?? [];
					const atts = Array.isArray(body.attachmentRefs) ? body.attachmentRefs : void 0;
					await manager.sendPrompt(parsed.id, blocks, void 0, atts);
					respond(res, 200, { ok: true });
				} else if (parsed.action === "cancel") {
					await manager.cancelSession(parsed.id);
					respond(res, 200, { ok: true });
				} else {
					await manager.closeSession(parsed.id);
					respond(res, 200, { ok: true });
				}
			} catch (err) {
				respond(res, 400, { error: String(err) });
			}
			return;
		}
		respond(res, 404, { error: "unknown action" });
	});
	return () => {
		for (const d of disposers) d();
		disposers.length = 0;
	};
}
// src/stream.ts
/** Fan-out ACP updates only to connections subscribed to that session. */
var StreamHub = class {
	connections = /* @__PURE__ */ new Set();
	subscribe(res, sessionIds) {
		res.writeHead(200, {
			"content-type": "text/event-stream; charset=utf-8",
			"connection": "keep-alive",
			"cache-control": "no-cache, no-transform"
		});
		res.write(": connected\n\n");
		const conn = {
			res,
			sessionIds: new Set(sessionIds),
			unsub: () => {},
			ping: setInterval(() => {
				try {
					res.write(": ping\n\n");
				} catch {}
			}, 25e3)
		};
		conn.ping.unref?.();
		const unsub = () => {
			clearInterval(conn.ping);
			this.connections.delete(conn);
			try {
				res.end();
			} catch {}
		};
		conn.unsub = unsub;
		this.connections.add(conn);
		res.on("close", unsub);
		return unsub;
	}
	/** Replace a connection's subscription set, addressed by its disposer. */
	setSubscribed(unsub, ids) {
		for (const c of this.connections) if (c.unsub === unsub) {
			c.sessionIds = new Set(ids);
			return;
		}
	}
	publish(sessionId, event) {
		const frame = "data: " + JSON.stringify({
			sessionId,
			event
		}) + "\n\n";
		for (const c of this.connections) {
			if (!c.sessionIds.has(sessionId)) continue;
			try {
				c.res.write(frame);
			} catch {
				c.unsub();
			}
		}
	}
	disconnectAll() {
		for (const c of [...this.connections]) c.unsub();
		this.connections.clear();
	}
};
// src/permission.ts
/**
* Turn an ACP permission request into a response according to policy.
* `ask` defers to the host hook (Plan 3 GUI card); Plan 1 falls back to a
* deterministic timeout so a request can never hang the agent forever.
*/
function decidePermission(config, p, defer) {
	const select = (kind) => {
		return { outcome: {
			outcome: "selected",
			optionId: (p.options.find((o) => kind.test(o.kind)) ?? p.options[0])?.optionId ?? ""
		} };
	};
	if (config.permissionPolicy === "deny") return { outcome: { outcome: "cancelled" } };
	if (config.permissionPolicy === "auto-allow") return select(/allow|approve|accept|yes/i);
	if (defer) {
		const timeout = new Promise((resolve) => {
			setTimeout(() => resolve({ outcome: { outcome: "cancelled" } }), config.permissionTimeoutMs).unref?.();
		});
		return Promise.race([defer(p), timeout]);
	}
	return { outcome: { outcome: "cancelled" } };
}
// src/index.ts
const name = "dsh-local-otagent-sidebar";
const inject = ["webServer", "connection"];
function apply(ctx, config) {
	const store = new SessionStore(dataDir());
	const hub = new StreamHub();
	const manager = new OtAgentManager(config, store, {
		broadcast: (sessionId, event) => hub.publish(sessionId, event),
		requestPermission: (_sessionId, p) => decidePermission(config, p)
	});
	ctx.inject(["webServer", "connection"], (webCtx) => {
		const otagentDir = dataDir();
		const dispose = installRoutes(webCtx, manager, config, hub, {
			uploadRoot: join(otagentDir, "uploads"),
			uploadMaxBytes: config.upload.maxBytes
		});
		ctx.effect(() => () => dispose(), "otagent: routes");
	});
	ctx.effect(() => async () => {
		hub.disconnectAll();
		await manager.dispose();
	}, "otagent: stop agents and stream");
}
export { Config, apply, inject, name };
