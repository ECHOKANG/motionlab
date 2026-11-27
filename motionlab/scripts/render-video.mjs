#!/usr/bin/env node
/** Offline frame renderer. Uses the same deterministic drawFilm as the product. */
import { readFile, writeFile, mkdir, access, mkdtemp, rm, rename } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HELP = `MotionLab deterministic MP4 renderer

Usage:
  node scripts/render-video.mjs --sample luma --output outputs/luma.mp4 --music
  node scripts/render-video.mjs --input project.json --output outputs/video.mp4

Options:
  --input <file>       Film JSON exported from the studio
  --sample <id>        Original sample: luma, form, flux, orbit (default: luma)
  --output <file>      MP4 destination (default: outputs/motionlab.mp4)
  --asset <file>       Local PNG/JPEG/WebP/GIF used in place of the project's image
  --fps <30|60>        Output frame rate (default: 30)
  --music             Add an original synthesized 120 BPM score
  --chrome <file>      Chrome executable; alternatively use CHROME_PATH
  --overwrite         Replace an existing output file
  --help              Show this help

Requires Node >= 22.13, installed Chrome/Chromium, FFmpeg with libx264,
and this project's dependencies. No model key or running web server is needed.
`;
function argsFrom(argv) {
  const flags = new Set(['music', 'overwrite', 'help']);
  const values = new Set(['input', 'sample', 'output', 'asset', 'fps', 'chrome']);
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--')) throw new Error(`Unexpected argument: ${argv[i]}`);
    if (flags.has(key)) result[key] = true;
    else if (values.has(key) && argv[i + 1] && !argv[i + 1].startsWith('--')) result[key] = argv[++i];
    else throw new Error(`Unknown option or missing value: ${argv[i]}`);
  }
  if (result.input && result.sample) throw new Error('Choose --input or --sample, not both.');
  if (result.fps && !['30', '60'].includes(result.fps)) throw new Error('--fps must be 30 or 60.');
  return result;
}
async function exists(file) { try { await access(file, constants.F_OK); return true; } catch { return false; } }
async function ownModule(relative) {
  const result = await build({ entryPoints: [path.join(root, relative)], absWorkingDir: root, bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
async function findChrome(explicit) {
  if (explicit) {
    const executable = path.resolve(explicit);
    await access(executable, constants.X_OK);
    return executable;
  }
  const candidates = process.platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'] : process.platform === 'win32' ? [path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'), path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe')] : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  candidates.push(chromium.executablePath());
  for (const candidate of candidates) if (await exists(candidate)) return candidate;
  throw new Error('Chrome/Chromium was not found. Install it, or provide --chrome /absolute/path/to/chrome.');
}
async function assetData(filename) {
  if (!filename) return undefined;
  const bytes = await readFile(path.resolve(filename));
  if (bytes.length > 8 * 1024 * 1024) throw new Error('The asset must be at most 8 MB.');
  let mime;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) mime = 'image/png';
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mime = 'image/jpeg';
  else if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') mime = 'image/webp';
  else if (['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))) mime = 'image/gif';
  if (!mime) throw new Error('Asset must be a PNG, JPEG, WebP or GIF image.');
  return `data:${mime};base64,${bytes.toString('base64')}`;
}
async function writeScore(duration, filename) {
  const rate = 48000, count = Math.round(duration * rate), samples = new Float32Array(count);
  const notes = [220, 261.63, 329.63, 392, 329.63, 261.63, 293.66, 329.63];
  const exp = (from, to, progress) => from * Math.pow(to / from, Math.max(0, Math.min(1, progress)));
  for (let beat = 0; beat * 0.5 < duration; beat++) {
    const start = Math.round((beat * 0.5 + 0.08) * rate), frequency = notes[beat % notes.length] * (beat % 4 === 3 ? 2 : 1);
    for (let i = 0; i < rate * 0.45 && start + i < count; i++) {
      const t = i / rate;
      const ng = t < 0.025 ? exp(0.0001, 0.18, t / 0.025) : exp(0.18, 0.0001, (t - 0.025) / 0.395);
      let value = Math.sin(2 * Math.PI * frequency * t) * ng;
      if (t < 0.24) {
        const kg = t < 0.008 ? exp(0.0001, 0.55, t / 0.008) : exp(0.55, 0.0001, (t - 0.008) / 0.212);
        const a = Math.log(42 / 110) / 0.16;
        const phase = 110 * (Math.exp(a * Math.min(t, 0.16)) - 1) / a + Math.max(0, t - 0.16) * 42;
        value += Math.sin(2 * Math.PI * phase) * kg;
      }
      const absolute = (start + i) / rate;
      const fade = Math.min(1, Math.max(0, duration - absolute));
      samples[start + i] += value * 0.2 * fade;
    }
  }
  const wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  await writeFile(filename, wav);
}

async function main() {
  const args = argsFrom(process.argv.slice(2));
  if (args.help) { console.log(HELP); return; }
  const output = path.resolve(args.output || 'outputs/motionlab.mp4');
  const projectOutput = output.replace(/\.mp4$/i, '.json');
  if (path.extname(output).toLowerCase() !== '.mp4') throw new Error('Output filename must end with .mp4.');
  if (!args.overwrite && await exists(output)) throw new Error('Output exists. Choose another filename or pass --overwrite.');
  if (!args.overwrite && await exists(projectOutput)) throw new Error('The matching project JSON exists. Choose another filename or pass --overwrite.');
  const executablePath = await findChrome(args.chrome || process.env.CHROME_PATH);
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { throw new Error('FFmpeg was not found. Install FFmpeg with H.264/libx264 support.'); }
  let raw;
  if (args.input) raw = JSON.parse(await readFile(path.resolve(args.input), 'utf8'));
  else {
    const { EXAMPLES } = await ownModule('lib/motion/examples.ts');
    raw = EXAMPLES.find(example => example.id === (args.sample || 'luma'))?.film;
    if (!raw) throw new Error('Unknown sample. Choose luma, form, flux or orbit.');
  }
  const { validateFilm } = await ownModule('lib/motion/planner.ts');
  const film = validateFilm(raw);
  if (film.assetUrl && !args.asset) throw new Error('This project uses a private uploaded image. Provide its local file using --asset; private URLs are never fetched by this CLI.');
  const asset = await assetData(args.asset);
  const fps = Number(args.fps || 30), width = film.aspect === '16:9' ? 1280 : 720, height = film.aspect === '9:16' ? 1280 : 720;
  const frames = Math.round(film.duration * fps);
  const rendererBundle = await build({ entryPoints: [path.join(root, 'lib/motion/renderer.ts')], absWorkingDir: root, bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'MotionLabRenderer', target: 'es2022' });
  const renderer = rendererBundle.outputFiles[0].text;
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'motionlab-render-'));
  const partial = path.join(path.dirname(output), `.${path.basename(output)}.${process.pid}.partial.mp4`);
  await mkdir(path.dirname(output), { recursive: true });
  let browser, encoder, interrupted = false;
  const interrupt = () => { interrupted = true; encoder?.kill('SIGTERM'); void browser?.close(); };
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    // Only our own renderer runs in this page; no application navigation or external requests.
    await page.route('**/*', route => route.abort());
    await page.setContent('<!doctype html><html><body style="margin:0"><canvas id="film"></canvas></body></html>');
    await page.addScriptTag({ content: `${renderer}\nwindow.drawFilm=MotionLabRenderer.drawFilm;` });
    await page.evaluate(async ({ film, width, height, asset }) => {
      const canvas = document.getElementById('film'); canvas.width = width; canvas.height = height;
      window.film = film; window.context = canvas.getContext('2d', { alpha: false });
      if (asset) { window.asset = new Image(); window.asset.src = asset; await window.asset.decode(); }
      await document.fonts.ready;
    }, { film, width, height, asset });
    const ffArgs = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(fps), '-i', 'pipe:0'];
    if (args.music) { const score = path.join(temporary, 'score.wav'); await writeScore(film.duration, score); ffArgs.push('-i', score); }
    ffArgs.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-frames:v', String(frames), '-t', String(film.duration), '-movflags', '+faststart');
    if (args.music) ffArgs.push('-c:a', 'aac', '-b:a', '192k'); else ffArgs.push('-an');
    ffArgs.push(partial);
    encoder = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'ignore', 'pipe'] });
    let errors = '', encodingError;
    encoder.stderr.on('data', chunk => { errors = (errors + chunk).slice(-12000); });
    encoder.stdin.on('error', error => { encodingError = error; });
    const exited = new Promise(resolve => { encoder.once('error', error => resolve({ error })); encoder.once('close', code => resolve({ code })); });
    console.log(`Rendering ${film.title}: ${width}×${height}, ${fps} fps, ${frames} frames${args.music ? ', original score' : ''}`);
    for (let frame = 0; frame < frames; frame++) {
      if (interrupted) throw new Error('Render cancelled.');
      if (encodingError || encoder.exitCode !== null) throw new Error(`FFmpeg encoding failed: ${errors || encodingError?.message}`);
      const data = await page.evaluate(time => { window.drawFilm(window.context, window.film, time, { asset: window.asset }); return document.getElementById('film').toDataURL('image/png').split(',')[1]; }, frame / fps);
      const png = Buffer.from(data, 'base64');
      if (!encoder.stdin.write(png)) await Promise.race([once(encoder.stdin, 'drain'), exited.then(result => { throw new Error(`FFmpeg stopped before completion: ${errors || result.error?.message || result.code}`); })]);
      if ((frame + 1) % fps === 0 || frame === frames - 1) console.log(`Frames ${frame + 1}/${frames} · ${Math.round((frame + 1) / frames * 100)}%`);
    }
    encoder.stdin.end();
    const result = await exited;
    if (result.error || result.code !== 0) throw new Error(`FFmpeg failed: ${errors || result.error?.message || result.code}`);
    if (!args.overwrite && await exists(output)) throw new Error('Output was created by another process; refusing to replace it.');
    await rename(partial, output);
    await writeFile(projectOutput, JSON.stringify(film, null, 2) + '\n', { flag: args.overwrite ? 'w' : 'wx' });
    console.log(JSON.stringify({ output, width, height, fps, duration: film.duration, frames, audio: Boolean(args.music), renderer: 'lib/motion/renderer.ts' }));
  } finally {
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    if (encoder && encoder.exitCode === null) encoder.kill('SIGTERM');
    if (browser) await browser.close();
    await rm(temporary, { recursive: true, force: true });
    await rm(partial, { force: true });
  }
}
main().catch(error => { console.error(`Render failed: ${error.message}`); process.exitCode = 1; });
