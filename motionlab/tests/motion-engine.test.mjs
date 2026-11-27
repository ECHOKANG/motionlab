import test from 'node:test';
import assert from 'node:assert/strict';
import { drawFilm, spring } from '../lib/motion/renderer.ts';

const film = {
  id: 'render-test', title: 'Motion test', prompt: 'A product launch', aspect: '16:9', style: 'aurora',
  duration: 15, fps: 30, createdAt: '2026-01-01', updatedAt: '2026-01-01',
  scenes: ['title', 'product', 'features', 'metric', 'cta'].map((layout, i) => ({
    id: String(i), layout, eyebrow: 'CREATE SOMETHING', headline: '让灵感，\n不止于想象。',
    body: '为每一个好想法，留出新的可能。', items: ['灵感收集', '智能整理', '轻松分享'], duration: 3,
  })),
};
function recordingContext() {
  const calls = [];
  const state = { canvas: { width: 1280, height: 720 }, font: '16px sans-serif', globalAlpha: 1 };
  const context = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'measureText') return value => ({ width: Array.from(value).length * Number((target.font.match(/([\d.]+)px/) || [0, 16])[1]) * 0.7 });
      if (key === 'createRadialGradient' || key === 'createLinearGradient') return (...args) => {
        calls.push([key, ...args]); return { addColorStop: (...values) => calls.push(['addColorStop', ...values]) };
      };
      return (...args) => {
        for (const value of args.flat()) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(key)} received ${value}`);
        calls.push([key, ...args]);
      };
    },
    set(target, key, value) { target[key] = value; calls.push(['set', String(key), typeof value === 'object' ? 'gradient' : value]); return true; },
  });
  return { context, calls };
}
function render(f, t) { const recording = recordingContext(); drawFilm(recording.context, f, t); return recording.calls; }

test('frame output is deterministic regardless of seek order', () => {
  const expected = render(film, 7.3);
  render(film, 14); render(film, 0.05); render(film, 4);
  assert.deepEqual(render(film, 7.3), expected);
  assert.notDeepEqual(render(film, 7.5), expected);
});

test('every scene and ratio renders finite geometry at entry, middle and exit', () => {
  for (const aspect of ['16:9', '9:16', '1:1']) {
    for (const style of ['aurora', 'midnight', 'citrus', 'rose']) {
      for (const time of [0, 0.1, 2.999, 3, 4, 6, 8.9, 9, 11, 12, 14.999, 15]) {
        const calls = render({ ...film, aspect, style }, time);
        assert.ok(calls.some(([name, value]) => name === 'fillText' && String(value).includes('让灵感')));
      }
    }
  }
});

test('invalid seek times and durations beyond a rounded timeline keep a valid frame', () => {
  for (const time of [NaN, Infinity, -10, 50]) assert.ok(render(film, time).length > 0);
  const calls = render({ ...film, duration: 16 }, 15.8);
  assert.ok(calls.some(([name, value]) => name === 'fillText' && value === '灵感收集'));
});

test('critically damped spring begins at zero and approaches one without overshoot', () => {
  assert.equal(spring(-1), 0); assert.equal(spring(0), 0);
  let previous = 0;
  for (let i = 1; i <= 100; i++) { const value = spring(i / 20); assert.ok(value >= previous && value <= 1); previous = value; }
  assert.ok(previous > 0.999);
});
