#!/usr/bin/env node
/**
 * 微信视频号视频解密工具（Node.js 版，无需浏览器 / Docker / 微信客户端）
 *
 * 原理：加载微信官方 wasm_video_decode.wasm，用 Module.WxIsaac64 生成
 *      131072 字节密钥流，reverse 后与视频前 128KB 做 XOR。
 *
 * 用法：
 *   node wx_decrypt.js <加密文件> <decode_key> [输出文件]
 * 例：
 *   node wx_decrypt.js encrypted.mp4 2136343393 decrypted.mp4
 *
 * 依赖文件（须与本脚本同目录）：
 *   wasm_video_decode.js
 *   wasm_video_decode.wasm
 *
 * 已解决的六个坑（改动前请先读）：
 *   1. 加载器为 Web Worker 编译，需伪造 self / location
 *   2. 必须定义微信自有全局变量 VTS_WASM_URL
 *   3. Node 的 fetch 不支持 file://，须屏蔽 fetch 迫使走 XHR 同步路径
 *   4. 需提供从本地 fs 读文件的 XMLHttpRequest 桩
 *   5. 不能用 require() 加载 —— 会让加载器里的 var Module 变成模块局部变量，
 *      导致注入的回调全部失效且进程静默挂住。必须用 vm 共享上下文。
 *   6. WxIsaac64 构造函数签名是 std::string，decode_key 必须传字符串
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DECRYPT_LEN = 131072; // 2^17，仅前 128KB 被加密

const inFile = process.argv[2];
const decodeKey = process.argv[3];
const outFile = process.argv[4] || 'decrypted.mp4';

if (!inFile || !decodeKey) {
  console.error('用法: node wx_decrypt.js <加密文件> <decode_key> [输出文件]');
  process.exit(1);
}
if (!fs.existsSync(inFile)) {
  console.error('输入文件不存在: ' + inFile);
  process.exit(1);
}

let keystream = null;

const sandbox = {
  console, process, Buffer, require, __dirname,
  setTimeout, clearTimeout, setInterval, clearInterval,
  WebAssembly, TextDecoder, TextEncoder, URL,
  performance: { now: () => Date.now() },
};
sandbox.global = sandbox;
sandbox.self = sandbox;                 // 坑 1
sandbox.window = undefined;
sandbox.location = { href: 'file://' + __dirname + '/' };
sandbox.importScripts = function () {};
sandbox.fetch = undefined;              // 坑 3
sandbox.VTS_WASM_URL = 'file://' + path.join(__dirname, 'wasm_video_decode.wasm'); // 坑 2

// 坑 4
sandbox.XMLHttpRequest = function () {
  this.responseType = '';
  this.status = 200;
  this.open = function (m, u) { this._url = u; };
  this.send = function () {
    let p = String(this._url).replace(/^file:\/\//, '');
    if (!fs.existsSync(p)) p = path.join(__dirname, path.basename(p));
    const b = fs.readFileSync(p);
    if (this.responseType === 'arraybuffer') {
      this.response = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    } else {
      this.responseText = b.toString('utf8');
      this.response = this.responseText;
    }
    if (typeof this.onload === 'function') this.onload();
  };
};

// WASM 生成密钥流后回调写回，必须 reverse
sandbox.wasm_isaac_generate = function (ptr, size) {
  const M = sandbox.Module;
  const heap = new Uint8Array(M.HEAPU8.buffer, ptr, size);
  const arr = new Uint8Array(size);
  arr.set(Uint8Array.prototype.slice.call(heap).reverse());
  keystream = arr;
};

['wasm_ffmpeg_error_report', 'wasm_ffmpeg_fwrite', 'wasm_ffmpeg_fsize',
 'wasm_ffmpeg_fseek', 'wasm_ffmpeg_fclose'].forEach(function (n) {
  sandbox[n] = function () { return 0; };
});

sandbox.Module = {
  print: function () {},
  printErr: function () {},
  onAbort: function (r) { console.error('WASM abort: ' + r); process.exit(9); },
  locateFile: function (f) { return path.join(__dirname, f); },
  onRuntimeInitialized: async function () {
    const M = sandbox.Module;
    if (typeof M.WxIsaac64 !== 'function') {
      console.error('WxIsaac64 未导出，WASM 版本可能不匹配');
      process.exit(7);
    }
    try {
      const d = new M.WxIsaac64(String(decodeKey)); // 坑 6
      await d.generate(DECRYPT_LEN);
      if (typeof d.delete === 'function') d.delete();

      if (!keystream) { console.error('密钥流生成失败'); process.exit(8); }

      const data = fs.readFileSync(inFile);
      const n = Math.min(DECRYPT_LEN, data.length);
      for (let i = 0; i < n; i++) data[i] ^= keystream[i];
      fs.writeFileSync(outFile, data);

      const ok = data.slice(4, 8).toString('latin1') === 'ftyp';
      console.log('输入      : ' + inFile + ' (' + data.length.toLocaleString() + ' bytes)');
      console.log('decode_key: ' + decodeKey);
      console.log('输出      : ' + outFile);
      console.log('文件头    : ' + data.slice(0, 16).toString('hex').replace(/(..)/g, '$1 ').trim());
      console.log('ftyp 校验 : ' + (ok ? '通过' : '失败'));
      if (!ok) {
        console.error('');
        console.error('提示：解密失败最常见原因是 decode_key 与加密文件不是同一次 API 响应获取的。');
        console.error('微信每次请求都会返回新的 url 和新的 decode_key，两者必须成对使用。');
      }
      process.exit(ok ? 0 : 3);
    } catch (e) {
      console.error('执行错误: ' + e.message);
      process.exit(10);
    }
  }
};

// 坑 5：必须用 vm 共享上下文，不能 require
const code = fs.readFileSync(path.join(__dirname, 'wasm_video_decode.js'), 'utf8');
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'wasm_video_decode.js' });

setTimeout(function () {
  console.error('超时：WASM 运行时未就绪');
  process.exit(1);
}, 60000);
