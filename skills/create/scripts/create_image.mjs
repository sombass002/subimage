#!/usr/bin/env node
// subimage: one entry point, two subscription backends, no API keys.
//   gemini = Antigravity CLI (agy) on a Google AI Pro/Ultra plan (via gemini_image.mjs)
//   codex  = Codex CLI ($imagegen) on a ChatGPT Plus/Pro plan
// Exit codes: 0 ok, 3 provider unavailable (not installed / not signed in), 4 quota reached, 1 other error.
// On 3 or 4 the next provider is tried when fallback is on.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();
const CONFIG = path.join(HOME, ".config", "subimage", "config.json");
const CODEX_IMAGES = path.join(HOME, ".codex", "generated_images");
const PROVIDERS = ["gemini", "codex"];
const IMG_RE = /\.(png|jpe?g|webp)$/i;

function die(msg, code = 1) {
  console.error(`ERROR: ${msg}`);
  process.exit(code);
}

export function providerOrder(primary, fallback) {
  return fallback ? [primary, ...PROVIDERS.filter((p) => p !== primary)] : [primary];
}

function readConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
    return { primary: PROVIDERS.includes(c.primary) ? c.primary : "gemini", fallback: c.fallback !== false };
  } catch {
    return { primary: "gemini", fallback: true };
  }
}

function writeConfig(c) {
  fs.mkdirSync(path.dirname(CONFIG), { recursive: true });
  fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2) + "\n");
}

// shortcut: uses `which`, so macOS/Linux only; add `where` + .exe paths for Windows support.
function findBin(name, extra = []) {
  for (const c of extra) if (c && fs.existsSync(c)) return c;
  const r = spawnSync("which", [name], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim().split("\n")[0] : null;
}
const agyBin = () => findBin("agy", [process.env.AGY_BIN, path.join(HOME, ".local", "bin", "agy"), "/opt/homebrew/bin/agy", "/usr/local/bin/agy"]);
const codexBin = () => findBin("codex");

function parseArgs(argv) {
  const o = { refs: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => (i + 1 < argv.length ? argv[++i] : die(`${a} needs a value`));
    if (a === "--prompt") o.prompt = next();
    else if (a === "--out") o.out = next();
    else if (a === "--ref") o.refs.push(next());
    else if (a === "--provider") o.provider = next();
    else if (a === "--no-fallback") o.noFallback = true;
    else if (a === "--overwrite") o.overwrite = true;
    else if (a === "--primary") o.primary = next();
    else if (a === "--fallback") o.fallback = next();
    else die(`unknown argument: ${a}`);
  }
  return o;
}

function dims(file) {
  if (process.platform !== "darwin") return "unknown";
  const r = spawnSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file], { encoding: "utf8" });
  const w = r.stdout?.match(/pixelWidth:\s*(\d+)/)?.[1];
  const h = r.stdout?.match(/pixelHeight:\s*(\d+)/)?.[1];
  return w && h ? `${w}x${h}` : "unknown";
}

function newestImageSince(dir, sinceMs) {
  let best = null;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { stack.push(p); continue; }
      if (!IMG_RE.test(e.name)) continue;
      const t = fs.statSync(p).mtimeMs;
      if (t >= sinceMs && (!best || t > best.t)) best = { p, t };
    }
  }
  return best?.p || null;
}

function copyTo(src, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const se = path.extname(src).toLowerCase().replace("jpeg", "jpg");
  const oe = path.extname(out).toLowerCase().replace("jpeg", "jpg");
  if (se === oe) { fs.copyFileSync(src, out); return out; }
  const fmt = { ".png": "png", ".jpg": "jpeg", ".webp": "webp" }[oe];
  if (fmt && process.platform === "darwin") {
    const r = spawnSync("sips", ["-s", "format", fmt, src, "--out", out], { encoding: "utf8" });
    if (r.status === 0) return out;
  }
  const fallback = out.replace(/\.[^.]+$/, se); // keep the original format rather than fail
  fs.copyFileSync(src, fallback);
  return fallback;
}

function runGemini(o) {
  if (!agyBin()) { console.error("gemini: Antigravity CLI (agy) is not installed."); return Promise.resolve(3); }
  const args = [path.join(HERE, "gemini_image.mjs"), "generate", "--prompt", o.prompt, "--out", o.out];
  for (const r of o.refs) args.push("--ref", r);
  if (o.overwrite) args.push("--overwrite");
  const child = spawn(process.execPath, args, { stdio: "inherit" });
  return new Promise((res) => child.on("close", (c) => res(c ?? 1)));
}

async function runCodex(o) {
  const codex = codexBin();
  if (!codex) { console.error("codex: Codex CLI is not installed."); return 3; }
  const env = { ...process.env };
  delete env.OPENAI_API_KEY; // keep billing on the ChatGPT plan, never the paid API
  const args = ["exec", "--sandbox", "read-only", "--skip-git-repo-check"];
  for (const r of o.refs) args.push("--image", r);
  const started = Date.now() - 2000;
  const t0 = Date.now();
  const child = spawn(codex, args, { env, stdio: ["pipe", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  // Prompt goes on stdin: without it `codex exec` waits for input and hangs.
  child.stdin.end(`$imagegen ${o.prompt}\n\nReply with the absolute path of each image.\n`);
  const code = await new Promise((res) => child.on("close", (c) => res(c ?? 1)));

  const tail = log.trim().split("\n").slice(-6).join("\n");
  if (/usage limit|rate limit|429|quota/i.test(log) && code !== 0) { console.error(`codex: quota reached.\n${tail}`); return 4; }
  if (/401|unauthorized|not logged in|codex login/i.test(log) && code !== 0) { console.error(`codex: not signed in. Run \`codex login\`.\n${tail}`); return 3; }
  if (code !== 0) { console.error(`codex: failed (exit ${code}).\n${tail}`); return 1; }

  const fromText = (log.match(/\/[^\s'"`]+\.(?:png|jpe?g|webp)/gi) || [])
    .reverse().find((p) => fs.existsSync(p) && fs.statSync(p).mtimeMs >= started);
  const src = fromText || newestImageSince(CODEX_IMAGES, started);
  if (!src) { console.error(`codex: finished but no new image file was found.\n${tail}`); return 1; }
  const out = copyTo(src, o.out);
  console.log(`PATH=${out}`);
  console.log(`SIZE=${dims(out)}`);
  console.log(`SOURCE=${src}`);
  console.log(`SECONDS=${Math.round((Date.now() - t0) / 1000)}`);
  console.log(`MARKDOWN=![${path.basename(out)}](${out})`);
  return 0;
}

async function generate(o) {
  if (!o.prompt) die("--prompt is required");
  if (o.provider && !PROVIDERS.includes(o.provider)) die(`--provider must be one of: ${PROVIDERS.join(", ")}`);
  const cfg = readConfig();
  const order = providerOrder(o.provider || cfg.primary, cfg.fallback && !o.noFallback);

  const cwd = process.cwd();
  o.refs = o.refs.map((r) => path.resolve(cwd, r));
  for (const r of o.refs) if (!fs.existsSync(r)) die(`reference not found: ${r}`);
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  o.out = path.resolve(cwd, o.out || path.join("generated-images", `image-${ts}.png`));
  if (fs.existsSync(o.out) && !o.overwrite) die(`output exists (use --overwrite): ${o.out}`);

  for (let i = 0; i < order.length; i++) {
    const p = order[i];
    const code = p === "gemini" ? await runGemini(o) : await runCodex(o);
    if (code === 0) { console.log(`PROVIDER=${p}`); process.exit(0); }
    const next = order[i + 1];
    if ((code === 3 || code === 4) && next) {
      console.error(`NOTE: ${p} ${code === 4 ? "quota reached" : "unavailable"}, switching to ${next}.`);
      continue;
    }
    process.exit(code);
  }
}

function config(o) {
  const c = readConfig();
  if (o.primary) {
    if (!PROVIDERS.includes(o.primary)) die(`--primary must be one of: ${PROVIDERS.join(", ")}`);
    c.primary = o.primary;
  }
  if (o.fallback) {
    if (!["on", "off"].includes(o.fallback)) die("--fallback must be on or off");
    c.fallback = o.fallback === "on";
  }
  if (o.primary || o.fallback) writeConfig(c);
  console.log(`PRIMARY=${c.primary}`);
  console.log(`FALLBACK=${c.fallback ? "on" : "off"}`);
}

function status() {
  const c = readConfig();
  console.log(`PRIMARY=${c.primary}`);
  console.log(`FALLBACK=${c.fallback ? "on" : "off"}`);
  const agy = agyBin();
  console.log(`GEMINI=${agy ? `installed (${agy}); sign in once by running agy` : "not installed"}`);
  const codex = codexBin();
  if (!codex) console.log("CODEX=not installed");
  else {
    const r = spawnSync(codex, ["login", "status"], { encoding: "utf8" });
    console.log(`CODEX=installed; ${(r.stdout || r.stderr || "").trim().split("\n")[0]}`);
  }
}

function selftest() {
  const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) die(`selftest: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
  eq(providerOrder("gemini", true), ["gemini", "codex"]);
  eq(providerOrder("codex", true), ["codex", "gemini"]);
  eq(providerOrder("codex", false), ["codex"]);
  console.log("selftest ok");
}

const [cmd, ...rest] = process.argv.slice(2);
const o = parseArgs(rest);
if (cmd === "generate") await generate(o);
else if (cmd === "config") config(o);
else if (cmd === "status") status();
else if (cmd === "selftest") selftest();
else die("usage: create_image.mjs generate|config|status|selftest [options]");
