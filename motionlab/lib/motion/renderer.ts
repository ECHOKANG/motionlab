import { drawCustomFilm } from './custom-renderer.ts';
import type { Film, Scene, StyleId } from './types';

type Ctx = CanvasRenderingContext2D;
type Palette = { bg: string; accent: string; light: string; second: string };
const PALETTES: Record<StyleId, Palette> = {
  aurora: { bg: '#100e1b', accent: '#ac94ff', light: '#f4eeff', second: '#77e7e3' },
  midnight: { bg: '#071521', accent: '#65bdf8', light: '#eaf7ff', second: '#7a8cff' },
  citrus: { bg: '#111a11', accent: '#c7f573', light: '#f4ffe7', second: '#43d6ad' },
  rose: { bg: '#221019', accent: '#ffac95', light: '#fff0eb', second: '#e48fda' },
};
const FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif';
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** Critically damped, closed-form spring: every frame depends only on t. */
export const spring = (t: number, stiffness = 10) => t <= 0 ? 0 : 1 - Math.exp(-stiffness * t) * (1 + stiffness * t);
const rgba = (hex: string, alpha: number) => {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${clamp(alpha)})`;
};
function round(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[] = 16) {
  ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), r);
}
function card(ctx: Ctx, x: number, y: number, w: number, h: number, fill = '#ffffff0a', stroke = '#ffffff16', r = 20) {
  round(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
}
function text(ctx: Ctx, value: string, x: number, y: number, size: number, color: string, weight = 400, align: CanvasTextAlign = 'left') {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top'; ctx.fillText(value, x, y);
}
function lines(ctx: Ctx, value: string, width: number): string[] {
  const result: string[] = []; let line = '';
  for (const char of Array.from(value || '')) {
    if (char === '\n') { result.push(line); line = ''; continue; }
    if (line && ctx.measureText(line + char).width > width) { result.push(line.trim()); line = char; } else line += char;
  }
  if (line) result.push(line.trim());
  return result;
}
function paragraph(ctx: Ctx, value: string, x: number, y: number, maxWidth: number, size: number, color: string, weight = 400, maxLines = 3, align: CanvasTextAlign = 'left') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const all = lines(ctx, value, maxWidth);
  const visible = all.slice(0, maxLines);
  if (all.length > maxLines && visible.length) {
    let last = visible[visible.length - 1];
    while (last && ctx.measureText(last + '…').width > maxWidth) last = Array.from(last).slice(0, -1).join('');
    visible[visible.length - 1] = last + '…';
  }
  visible.forEach((line, index) => text(ctx, line, x, y + index * size * 1.4, size, color, weight, align));
  return visible.length * size * 1.4;
}
function heading(ctx: Ctx, value: string, x: number, y: number, maxWidth: number, baseSize: number, color: string, align: CanvasTextAlign = 'left', maxLines = 3) {
  let size = baseSize;
  while (size > baseSize * 0.64) { ctx.font = `650 ${size}px ${FONT}`; if (lines(ctx, value, maxWidth).length <= maxLines) break; size -= 2; }
  return paragraph(ctx, value, x, y, maxWidth, size, color, 650, maxLines, align);
}
function glow(ctx: Ctx, x: number, y: number, radius: number, color: string, strength = 0.2) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius); g.addColorStop(0, rgba(color, strength)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
function orb(ctx: Ctx, x: number, y: number, radius: number, t: number, p: Palette) {
  ctx.save(); ctx.translate(x, y + Math.sin(t * 0.85) * 7);
  glow(ctx, 0, 0, radius * 1.7, p.accent, 0.21);
  ctx.save(); ctx.rotate(-0.4 + Math.sin(t * 0.22) * 0.12);
  const ball = ctx.createRadialGradient(-radius * 0.38, -radius * 0.45, radius * 0.03, 0, 0, radius);
  ball.addColorStop(0, '#ffffff'); ball.addColorStop(0.12, p.light); ball.addColorStop(0.29, p.accent); ball.addColorStop(0.54, p.second); ball.addColorStop(0.72, p.accent); ball.addColorStop(0.87, '#322044'); ball.addColorStop(1, p.bg);
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fillStyle = ball; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.clip();
  for (let i = 0; i < 30; i++) {
    const offset = (i / 29 - 0.5) * radius * 2;
    const r = Math.sqrt(Math.max(0, radius * radius - offset * offset));
    ctx.beginPath(); ctx.ellipse(offset * 0.24, offset, r, r * 0.23, 0, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(i < 12 ? '#ffffff' : p.second, 0.1 + (i % 4) * 0.04); ctx.lineWidth = 1.2; ctx.stroke();
  }
  const shadow = ctx.createLinearGradient(-radius, -radius, radius, radius); shadow.addColorStop(0, '#ffffff22'); shadow.addColorStop(0.4, '#ffffff00'); shadow.addColorStop(1, '#080515ad'); ctx.fillStyle = shadow; ctx.fillRect(-radius, -radius, radius * 2, radius * 2); ctx.restore(); ctx.restore();
  for (let i = 0; i < 3; i++) {
    ctx.save(); ctx.rotate(-0.5 + i * 0.16 + t * 0.065);
    const ring = ctx.createLinearGradient(-radius * 1.6, 0, radius * 1.6, 0); ring.addColorStop(0, rgba(p.accent, 0)); ring.addColorStop(0.4, rgba(p.light, 0.8)); ring.addColorStop(0.75, rgba(p.second, 0.6)); ring.addColorStop(1, rgba(p.accent, 0));
    ctx.beginPath(); ctx.ellipse(0, 0, radius * (1.35 + i * 0.1), radius * (0.35 + i * 0.04), 0, 0.05, Math.PI * 1.06); ctx.strokeStyle = ring; ctx.lineWidth = 1.4 + i * 0.5; ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}
function dashboard(ctx: Ctx, x: number, y: number, w: number, h: number, t: number, p: Palette, scene: Scene) {
  ctx.save(); const reveal = spring(t + 0.15, 7); ctx.translate(x, y + (1 - reveal) * 35); ctx.rotate(Math.sin(t * 0.35) * 0.008);
  ctx.shadowColor = '#00000066'; ctx.shadowBlur = 55; ctx.shadowOffsetY = 30; card(ctx, 0, 0, w, h, '#151522', '#ffffff28', 22); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(22 + i * 13, 22, 3.5, 0, Math.PI * 2); ctx.fillStyle = ['#f38c9c', '#f4d38c', '#a2d4b2'][i]; ctx.fill(); }
  text(ctx, 'WORKSPACE', w - 28, 15, 10, '#b3adca', 500, 'right');
  ctx.beginPath(); ctx.moveTo(0, 44); ctx.lineTo(w, 44); ctx.strokeStyle = '#ffffff12'; ctx.stroke();
  const pad = 26;
  text(ctx, scene.items[0]?.slice(0, 18) || '灵感，正在发生', pad, 65, 20, p.light, 600);
  text(ctx, 'Make something remarkable.', pad, 98, 11, '#9a94b0');
  const chartTop = 141, chartHeight = h * 0.33;
  card(ctx, pad, chartTop, w - pad * 2, chartHeight, '#ffffff04', '#ffffff0b', 12);
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(pad + 15, chartTop + 18 + i * (chartHeight - 32) / 3); ctx.lineTo(w - pad - 15, chartTop + 18 + i * (chartHeight - 32) / 3); ctx.strokeStyle = '#ffffff08'; ctx.stroke(); }
  const bars = [0.27, 0.45, 0.35, 0.64, 0.49, 0.78, 0.69, 0.96];
  const chartW = w - pad * 2 - 36;
  for (let i = 0; i < bars.length; i++) {
    const a = spring(t - i * 0.055 + 0.15, 7), bw = chartW / bars.length * 0.63, bh = bars[i] * (chartHeight - 28) * a;
    const gx = pad + 18 + i * chartW / bars.length, gy = chartTop + chartHeight - 14 - bh;
    const gradient = ctx.createLinearGradient(0, gy, 0, chartTop + chartHeight); gradient.addColorStop(0, i === bars.length - 1 ? p.second : p.accent); gradient.addColorStop(1, rgba(p.accent, 0.14));
    round(ctx, gx, gy, bw, bh, [4, 4, 0, 0]); ctx.fillStyle = gradient; ctx.fill();
  }
  const rowY = chartTop + chartHeight + 21;
  for (let i = 0; i < 2; i++) {
    const cw = (w - pad * 2 - 12) / 2;
    card(ctx, pad + i * (cw + 12), rowY, cw, Math.max(60, h - rowY - pad), '#ffffff05', '#ffffff0d', 10);
    text(ctx, scene.items[i + 1]?.slice(0, 12) || ['让灵感流动', '把想法实现'][i], pad + 12 + i * (cw + 12), rowY + 14, 11, '#b3adca');
    text(ctx, i === 0 ? 'Create.' : 'Launch.', pad + 12 + i * (cw + 12), rowY + 38, 21, i === 0 ? p.light : p.accent, 600);
  }
  ctx.restore();
}
function featureCards(ctx: Ctx, x: number, y: number, w: number, t: number, p: Palette, scene: Scene) {
  const items = scene.items.length ? scene.items.slice(0, 3) : ['从灵感开始', '让细节发光', '为你而创造'];
  items.forEach((item, i) => {
    const a = spring(t - i * 0.16 + 0.1, 9);
    ctx.save(); ctx.globalAlpha *= a; ctx.translate((1 - a) * 45, 0);
    card(ctx, x + (i % 2) * 12, y + i * 100, w - 12, 82, i === 1 ? rgba(p.accent, 0.12) : '#ffffff05', i === 1 ? rgba(p.accent, 0.34) : '#ffffff15', 18);
    card(ctx, x + 18 + (i % 2) * 12, y + i * 100 + 19, 43, 43, rgba(p.accent, 0.1), rgba(p.accent, 0.2), 12);
    text(ctx, ['✦', '◈', '↗'][i], x + 40 + (i % 2) * 12, y + i * 100 + 28, 22, p.accent, 500, 'center');
    paragraph(ctx, item, x + 80 + (i % 2) * 12, y + i * 100 + 29, w - 115, 19, p.light, 500, 1);
    ctx.restore();
  });
}
function metrics(ctx: Ctx, x: number, y: number, w: number, t: number, p: Palette, scene: Scene) {
  const items = scene.items.length ? scene.items.slice(0, 3) : ['更少繁琐', '更多可能', '灵感加速'];
  items.forEach((item, i) => {
    const a = spring(t - i * 0.15 + 0.15, 7);
    card(ctx, x, y + i * 105, w, 88, '#ffffff04', '#ffffff0f', 16);
    text(ctx, item.slice(0, 22), x + 22, y + i * 105 + 17, 18, p.light, 500);
    round(ctx, x + 22, y + i * 105 + 55, w - 44, 6, 3); ctx.fillStyle = '#ffffff10'; ctx.fill();
    round(ctx, x + 22, y + i * 105 + 55, (w - 44) * (0.55 + i * 0.16) * a, 6, 3); ctx.fillStyle = i === 2 ? p.second : p.accent; ctx.fill();
  });
}
function asset(ctx: Ctx, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  ctx.save(); round(ctx, x, y, w, h, 24); ctx.clip(); const ratio = Math.min(w / image.naturalWidth, h / image.naturalHeight); const iw = image.naturalWidth * ratio, ih = image.naturalHeight * ratio; ctx.fillStyle = '#ffffff08'; ctx.fillRect(x, y, w, h); ctx.drawImage(image, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); ctx.restore();
}
function sceneContent(ctx: Ctx, scene: Scene, film: Film, t: number, W: number, H: number, p: Palette, image?: HTMLImageElement) {
  const portrait = H > W * 1.2, square = Math.abs(W - H) < 10;
  const compact = portrait || square;
  const pad = W * 0.073;
  const enter = spring(t + 0.15, 9);
  const cx = compact ? W / 2 : pad;
  const textWidth = compact ? W - pad * 2 : W * 0.44;
  const top = portrait ? H * 0.16 : square ? H * 0.13 : H * 0.27;
  const align = compact ? 'center' : 'left';
  ctx.save(); ctx.translate(0, (1 - enter) * 24);
  text(ctx, (scene.eyebrow || 'MADE FOR YOUR NEXT BIG IDEA').slice(0, 38), cx, top - 43, compact ? 17 : 15, p.accent, 550, align);
  const headlineH = heading(ctx, scene.headline, cx, top, textWidth, portrait ? 64 : square ? 65 : 60, p.light, align, compact ? 2 : 3);
  const bodyY = top + headlineH + 18;
  paragraph(ctx, scene.body, cx, bodyY, textWidth, compact ? 22 : 20, '#b4adca', 400, 2, align);
  if (scene.layout === 'cta') {
    const by = bodyY + 85, bw = compact ? 236 : 214;
    card(ctx, compact ? cx - bw / 2 : cx, by, bw, 57, p.accent, '#ffffff44', 29);
    text(ctx, (scene.items[0] || '开启你的下一步').slice(0, 12), compact ? cx : cx + bw / 2, by + 17, 18, p.bg, 650, 'center');
  }
  ctx.restore();
  const visualTop = portrait ? H * 0.48 : square ? H * 0.47 : H * 0.22;
  const visualX = compact ? W * 0.17 : W * 0.57;
  const visualW = compact ? W * 0.66 : W * 0.355;
  const visualH = portrait ? H * 0.34 : square ? H * 0.36 : H * 0.56;
  if (image?.complete && image.naturalWidth && (scene.layout === 'product' || scene.layout === 'title')) {
    glow(ctx, visualX + visualW / 2, visualTop + visualH / 2, visualW * 0.75, p.accent, 0.18);
    asset(ctx, image, visualX, visualTop, visualW, visualH); return;
  }
  if (scene.layout === 'product') dashboard(ctx, visualX, visualTop, visualW, visualH, t, p, scene);
  else if (scene.layout === 'features') featureCards(ctx, visualX, visualTop + 10, visualW, t, p, scene);
  else if (scene.layout === 'metric') metrics(ctx, visualX, visualTop + 5, visualW, t, p, scene);
  else {
    const radius = compact ? W * 0.205 : W * 0.145;
    orb(ctx, visualX + visualW / 2, visualTop + visualH / 2, radius * (0.9 + enter * 0.1), t, p);
    if (scene.layout === 'title') {
      const label = (scene.items[0] || 'Designed for possibility').slice(0, 24);
      ctx.font = `500 13px ${FONT}`; const lw = Math.min(visualW, ctx.measureText(label).width + 38);
      card(ctx, visualX + visualW / 2 - lw / 2, visualTop + visualH - 5, lw, 34, '#ffffff09', '#ffffff20', 17);
      text(ctx, label, visualX + visualW / 2, visualTop + visualH + 5, 13, p.light, 450, 'center');
    }
  }
}
/** Draw at any point in time. No wall-clock timers, random state, or DOM layout are used. */
export function drawFilm(ctx: Ctx, film: Film, time: number, options: { asset?: HTMLImageElement } = {}): void {
  if (film.creationMode === 'custom') { drawCustomFilm(ctx, film, time, options); return; }
  const W = film.aspect === '9:16' ? 720 : film.aspect === '1:1' ? 960 : 1280;
  const H = film.aspect === '9:16' ? 1280 : film.aspect === '1:1' ? 960 : 720;
  const p = PALETTES[film.style] || PALETTES.aurora;
  const t = clamp(Number.isFinite(time) ? time : 0, 0, Math.max(0, film.duration - 0.001));
  ctx.save(); ctx.setTransform(ctx.canvas.width / W, 0, 0, ctx.canvas.height / H, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
  glow(ctx, W * 0.74, H * 0.5, Math.max(W, H) * 0.6, p.accent, 0.105);
  glow(ctx, W * 0.08, H * 0.9, W * 0.5, p.second, 0.055);
  for (let i = 0; i < 100; i++) { const x = ((i * 127.31) % W), y = ((i * 81.73) % H); ctx.fillStyle = '#ffffff07'; ctx.fillRect(x, y, 1.5, 1.5); }
  const pad = W * 0.073;
  text(ctx, '✳', pad, 40, 25, p.accent, 500);
  paragraph(ctx, film.title || 'YOUR NEXT BIG IDEA', pad + 38, 45, W * 0.6, 15, '#e8e3f5', 550, 1);
  text(ctx, 'MOTION / STUDIO', W - pad, 48, 10, '#948ba9', 450, 'right');
  let start = 0, index = Math.max(0, film.scenes.length - 1);
  for (let i = 0; i < film.scenes.length; i++) {
    if (t < start + film.scenes[i].duration || i === film.scenes.length - 1) { index = i; break; }
    start += film.scenes[i].duration;
  }
  const localT = Math.max(0, t - start);
  const current = film.scenes[index];
  if (current) {
    const transition = index > 0 ? clamp(localT / 0.32) : 1;
    if (transition < 1) { ctx.save(); ctx.globalAlpha = 1 - transition; sceneContent(ctx, film.scenes[index - 1], film, film.scenes[index - 1].duration, W, H, p, options.asset); ctx.restore(); }
    ctx.save(); ctx.globalAlpha = transition; sceneContent(ctx, current, film, localT, W, H, p, options.asset); ctx.restore();
  }
  ctx.fillStyle = '#ffffff0b'; ctx.fillRect(pad, H - 39, W - pad * 2, 1);
  ctx.fillStyle = rgba(p.accent, 0.65); ctx.fillRect(pad, H - 39, (W - pad * 2) * clamp(t / Math.max(1, film.duration)), 1);
  text(ctx, (current?.eyebrow || 'CREATE SOMETHING REMARKABLE').slice(0, 36), pad, H - 26, 9, '#8a829b', 450);
  text(ctx, 'MADE WITH MOTIONLAB', W - pad, H - 26, 9, '#8a829b', 450, 'right');
  ctx.restore();
}
