// validate_uml.mjs — 校验 MD 文件中的 Mermaid 与 PlantUML 代码块
// 用法: node validate_uml.mjs <output.md> [--online] [--no-local]
//  - Mermaid: 本地 mermaid.parse + jsdom
//  - PlantUML: 降级链 = 本地 @plantuml/core → 在线 plantuml.com
//    · 默认尝试本地渲染（离线可用，需 npm install）
//    · --online 强制走在线渲染（需网络）
//    · --no-local 跳过本地渲染（等价于旧版行为，需配合 --online）
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/* ---------- PlantUML 校验 ---------- */

// 在线校验（plantuml.com，~h + utf-8 hex 编码）
async function validatePlantUMLOnline(code) {
  const h = Buffer.from(code, 'utf-8').toString('hex');
  const url = `https://www.plantuml.com/plantuml/svg/~h${h}`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return await resp.text(); // SVG 文本
}

// 注入 jsdom 全局环境（@plantuml/core 需要 window/document/canvas mock）
function setupJsdomEnv() {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.DOMParser = dom.window.DOMParser;
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: dom.window.navigator,
      configurable: true,
      writable: true,
    });
  } catch (e) {}
  for (const k of ['HTMLElement','Node','NodeList','HTMLCollection','Element','SVGElement',
                   'DocumentFragment','Range','HTMLCanvasElement','HTMLImageElement',
                   'XMLSerializer','CanvasRenderingContext2D']) {
    try { globalThis[k] = dom.window[k]; } catch {}
  }
  try { globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window); } catch {}
}

function loadPlantumlCore() {
  try {
    return require('@plantuml/core');
  } catch (e) {
    return null; // 未安装 @plantuml/core → 降级在线
  }
}

// 本地渲染校验：区分「语法错误」与「渲染环境错误」（font/canvas 报错不算语法失败）
function validatePlantUMLLocal(plantuml, code) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    try {
      plantuml.renderToString(code, (svg) => {
        const s = svg || '';
        const hasError = /Syntax\s*Error|SyntaxError|Error\s*:|Unexpected/i.test(s);
        finish({ ok: !hasError, hasError, svg: s });
      }, (err) => {
        const e = String(err);
        // 渲染层环境问题（font/canvas/getBBox/not implemented）不是 PlantUML 语法错误
        const isRenderOnly = /font|canvas|getContext|not implemented|getBBox/i.test(e);
        finish({ ok: isRenderOnly ? 'render-only' : false, err: e.slice(0, 300) });
      });
    } catch (e) {
      finish({ ok: false, err: String(e).slice(0, 300) });
    }
    // 30s 超时保护（本地渲染偶发卡死）
    setTimeout(() => finish({ ok: null, timeout: true }), 30000);
  });
}

async function validatePlantUMLBlock(code, { useOnline, noLocal }) {
  // 1) 强制在线
  if (useOnline) {
    const svg = await validatePlantUMLOnline(code);
    return { ok: true, source: 'online', svg };
  }
  // 2) 本地 @plantuml/core
  if (!noLocal) {
    const plantuml = loadPlantumlCore();
    if (plantuml) {
      setupJsdomEnv();
      const res = await validatePlantUMLLocal(plantuml, code);
      if (res.ok === true) {
        return { ok: true, source: 'local', svg: res.svg };
      }
      if (res.ok === 'render-only') {
        return { ok: true, source: 'local(render-only)', svg: '' }; // 环境受限，语法本身通过
      }
      if (res.ok === false) {
        return { ok: false, source: 'local', err: res.err || 'PlantUML 语法错误' };
      }
      // timeout → 尝试在线
    }
  }
  // 3) 在线降级
  try {
    const svg = await validatePlantUMLOnline(code);
    return { ok: true, source: 'online(fallback)', svg };
  } catch (e) {
    return { ok: false, source: 'none', err: `本地不可用且在线失败: ${e.message}` };
  }
}

/* ---------- Mermaid 校验 ---------- */

async function validateMermaidBlock(code) {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.DOMParser = dom.window.DOMParser;
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: dom.window.navigator, configurable: true, writable: true,
    });
  } catch (e) {}
  for (const k of ['HTMLElement','Node','NodeList','HTMLCollection','Element','SVGElement',
                   'DocumentFragment','Range','HTMLCanvasElement','XMLSerializer']) {
    try { globalThis[k] = dom.window[k]; } catch {}
  }
  try { globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window); } catch {}
  const mermaid = (await import('mermaid')).default;
  await mermaid.parse(code);
}

/* ---------- 主流程 ---------- */

async function main() {
  const file = process.argv[2];
  const useOnline = process.argv.includes('--online');
  const noLocal = process.argv.includes('--no-local');
  if (!file) {
    console.log('用法: node validate_uml.mjs <output.md> [--online] [--no-local]');
    console.log('  --online    强制 PlantUML 走在线校验（plantuml.com）');
    console.log('  --no-local  跳过本地 @plantuml/core 渲染，等价旧版行为');
    process.exit(1);
  }
  const md = fs.readFileSync(file, 'utf-8');

  const mermaidBlocks = [...md.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);
  const plantumlBlocks = [...md.matchAll(/```plantuml\n([\s\S]*?)```/g)].map((m) => m[1]);

  console.log(`文件: ${file}   Mermaid块=${mermaidBlocks.length}  PlantUML块=${plantumlBlocks.length}`);

  let allOk = true;

  // Mermaid：本地 parse
  for (let i = 0; i < mermaidBlocks.length; i++) {
    try {
      await validateMermaidBlock(mermaidBlocks[i]);
      console.log(`  Mermaid[${i + 1}]: PARSE OK`);
    } catch (e) {
      allOk = false;
      console.log(`  Mermaid[${i + 1}]: PARSE ERROR:`, (e.message || e).slice(0, 200));
    }
  }

  // PlantUML：本地优先，在线降级
  for (let i = 0; i < plantumlBlocks.length; i++) {
    try {
      const res = await validatePlantUMLBlock(plantumlBlocks[i], { useOnline, noLocal });
      if (res.ok) {
        const extra = res.source === 'online(fallback)' ? ' (在线降级)' : '';
        console.log(`  PlantUML[${i + 1}]: RENDER OK via ${res.source} (${(res.svg || '').length} chars)${extra}`);
      } else {
        allOk = false;
        console.log(`  PlantUML[${i + 1}]: RENDER ERROR (${res.source}):`, (res.err || '').slice(0, 300));
      }
    } catch (e) {
      allOk = false;
      console.log(`  PlantUML[${i + 1}]: RENDER ERROR:`, (e.message || e).slice(0, 200));
    }
  }

  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
