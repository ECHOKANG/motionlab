import type { CustomLayer, Film, KeyframeProperty, LayerKeyframe } from './types';

type Ctx = CanvasRenderingContext2D;
const FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif';
const PROPERTIES: KeyframeProperty[] = ['x', 'y', 'width', 'height', 'rotation', 'opacity', 'scale'];
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
function easing(progress: number, kind: LayerKeyframe['easing']): number {
  const p = clamp(progress);
  if (kind === 'linear') return p;
  if (kind === 'spring') {
    // Normalized critical damping gives exact endpoints without overshoot.
    return (1 - Math.exp(-8 * p) * (1 + 8 * p)) / (1 - Math.exp(-8) * 9);
  }
  return p * p * (3 - 2 * p);
}
/** Per-property keyframes interpolate from the base value at t=0 and hold their last value. */
export function sampleLayer(layer: CustomLayer, time: number): CustomLayer {
  const t = Math.max(0, Number.isFinite(time) ? time : 0);
  const result = { ...layer };
  for (const property of PROPERTIES) {
    let previousTime = 0;
    let previousValue = layer[property];
    for (const frame of layer.keyframes) {
      const nextValue = frame[property];
      if (typeof nextValue !== 'number') continue;
      if (t < frame.time) {
        const progress = frame.time > previousTime ? (t - previousTime) / (frame.time - previousTime) : 1;
        previousValue += (nextValue - previousValue) * easing(progress, frame.easing);
        break;
      }
      previousTime = frame.time;
      previousValue = nextValue;
    }
    result[property] = previousValue;
  }
  result.opacity = clamp(result.opacity);
  result.width = Math.max(0, result.width);
  result.height = Math.max(0, result.height);
  result.scale = Math.max(0, result.scale);
  return result;
}
function rounded(ctx: Ctx, width: number, height: number, radius: number) {
  ctx.beginPath(); ctx.roundRect(0, 0, width, height, Math.max(0, Math.min(radius, width / 2, height / 2)));
}
function fillPaint(ctx: Ctx, layer: CustomLayer, width: number, height: number): string | CanvasGradient {
  if (!layer.gradient) return layer.fill;
  const angle = layer.gradient.angle * Math.PI / 180;
  const halfSpan = (Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle))) / 2;
  const dx = Math.cos(angle) * halfSpan, dy = Math.sin(angle) * halfSpan;
  const gradient = ctx.createLinearGradient(width / 2 - dx, height / 2 - dy, width / 2 + dx, height / 2 + dy);
  gradient.addColorStop(0, layer.fill); gradient.addColorStop(1, layer.gradient.to);
  return gradient;
}
function wrappedText(ctx: Ctx, value: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split('\n')) {
    let current = '';
    for (const character of Array.from(paragraph)) {
      if (current && ctx.measureText(current + character).width > width) { lines.push(current); current = character; }
      else current += character;
    }
    lines.push(current);
  }
  return lines;
}
function renderLayer(ctx: Ctx, source: CustomLayer, time: number, width: number, height: number, image?: HTMLImageElement) {
  const layer = sampleLayer(source, time);
  if (layer.opacity <= 0 || layer.scale <= 0) return;
  if (layer.type === 'line' ? layer.width <= 0 && layer.height <= 0 : layer.width <= 0 || layer.height <= 0) return;
  const w = layer.width * width, h = layer.height * height, short = Math.min(width, height);
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.translate(layer.x * width + w / 2, layer.y * height + h / 2);
  ctx.rotate(layer.rotation * Math.PI / 180); ctx.scale(layer.scale, layer.scale); ctx.translate(-w / 2, -h / 2);
  ctx.fillStyle = fillPaint(ctx, layer, w, h); ctx.strokeStyle = layer.stroke; ctx.lineWidth = layer.strokeWidth * short;
  if (layer.type === 'text') {
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    const fontSize = Math.max(1, (layer.fontSize ?? 0.08) * short);
    ctx.font = `${layer.fontWeight ?? 500} ${fontSize}px ${FONT}`;
    ctx.textBaseline = 'top'; ctx.textAlign = layer.align ?? 'left';
    const x = layer.align === 'center' ? w / 2 : layer.align === 'right' ? w : 0;
    const lineHeight = fontSize * 1.25;
    const lines = wrappedText(ctx, layer.text ?? '', w);
    for (let i = 0; i < lines.length && i * lineHeight < h; i++) ctx.fillText(lines[i], x, i * lineHeight);
  } else if (layer.type === 'image') {
    if (image?.complete && image.naturalWidth && image.naturalHeight) {
      rounded(ctx, w, h, layer.radius * short); ctx.clip();
      const fit = Math.min(w / image.naturalWidth, h / image.naturalHeight);
      const iw = image.naturalWidth * fit, ih = image.naturalHeight * fit;
      ctx.drawImage(image, (w - iw) / 2, (h - ih) / 2, iw, ih);
    }
  } else if (layer.type === 'line') {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h);
    ctx.strokeStyle = layer.strokeWidth > 0 ? layer.stroke : layer.fill;
    ctx.lineWidth = Math.max(1, layer.strokeWidth * short); ctx.lineCap = 'round'; ctx.stroke();
  } else {
    ctx.beginPath();
    if (layer.type === 'rect') rounded(ctx, w, h, layer.radius * short);
    else if (layer.type === 'ellipse') ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (layer.type === 'polygon' && layer.points?.length) {
      layer.points.forEach(([px, py], i) => { if (i === 0) ctx.moveTo(px * w, py * h); else ctx.lineTo(px * w, py * h); });
      ctx.closePath();
    }
    ctx.fill(); if (layer.strokeWidth > 0) ctx.stroke();
  }
  ctx.restore();
}
/** Freeform composition only: no template visuals, branding, automatic transitions or labels. */
export function drawCustomFilm(ctx: Ctx, film: Film, time: number, options: { asset?: HTMLImageElement } = {}): void {
  const width = film.aspect === '16:9' ? 1280 : 720;
  const height = film.aspect === '9:16' ? 1280 : 720;
  const t = clamp(Number.isFinite(time) ? time : 0, 0, Math.max(0, film.duration - 0.001));
  let start = 0;
  let scene = film.scenes[film.scenes.length - 1];
  for (let i = 0; i < film.scenes.length; i++) {
    scene = film.scenes[i];
    if (t < start + scene.duration || i === film.scenes.length - 1) break;
    start += scene.duration;
  }
  const composition = scene?.composition;
  ctx.save(); ctx.setTransform(ctx.canvas.width / width, 0, 0, ctx.canvas.height / height, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, width, height);
  // Video containers are opaque; use the same black underlay in preview and export.
  ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, width, height);
  if (composition?.backgroundEnd) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, composition.background); gradient.addColorStop(1, composition.backgroundEnd); ctx.fillStyle = gradient;
  } else ctx.fillStyle = composition?.background ?? '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip();
  for (const layer of composition?.layers ?? []) renderLayer(ctx, layer, Math.max(0, t - start), width, height, options.asset);
  ctx.restore();
}
