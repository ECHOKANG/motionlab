import type { Film } from './types';
import { drawFilm } from './renderer';

export interface ExportOptions { onProgress: (progress: number) => void; signal?: AbortSignal; music?: boolean; }
export interface VideoResult { blob: Blob; extension: string; }
export function supportedVideoFormat(): { mime: string; extension: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const format of [
    { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4' },
    { mime: 'video/mp4', extension: 'mp4' },
    { mime: 'video/webm;codecs=vp9,opus', extension: 'webm' },
    { mime: 'video/webm;codecs=vp8,opus', extension: 'webm' },
    { mime: 'video/webm', extension: 'webm' },
  ]) if (MediaRecorder.isTypeSupported(format.mime)) return format;
  return null;
}
function abortError() { return new DOMException('视频导出已取消', 'AbortError'); }
async function loadAsset(url: string | undefined, signal?: AbortSignal): Promise<HTMLImageElement | undefined> {
  if (!url) return undefined;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('素材加载失败，请重新上传后导出');
  const blobUrl = URL.createObjectURL(await response.blob());
  try { const image = new Image(); image.src = blobUrl; await image.decode(); return image; }
  finally { URL.revokeObjectURL(blobUrl); }
}
/** Original synthesized 120 BPM score. No licensed audio assets are used. */
function scheduleScore(audio: AudioContext, destination: MediaStreamAudioDestinationNode, duration: number) {
  const master = audio.createGain(); master.gain.value = 0.2; master.connect(destination);
  const start = audio.currentTime + 0.08;
  const notes = [220, 261.63, 329.63, 392, 329.63, 261.63, 293.66, 329.63];
  for (let beat = 0; beat * 0.5 < duration; beat++) {
    const at = start + beat * 0.5;
    const kick = audio.createOscillator(), kg = audio.createGain();
    kick.frequency.setValueAtTime(110, at); kick.frequency.exponentialRampToValueAtTime(42, at + 0.16);
    kg.gain.setValueAtTime(0.0001, at); kg.gain.exponentialRampToValueAtTime(0.55, at + 0.008); kg.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    kick.connect(kg).connect(master); kick.start(at); kick.stop(at + 0.24);
    const note = audio.createOscillator(), ng = audio.createGain(); note.type = 'sine'; note.frequency.value = notes[beat % notes.length] * (beat % 4 === 3 ? 2 : 1);
    ng.gain.setValueAtTime(0.0001, at); ng.gain.exponentialRampToValueAtTime(0.18, at + 0.025); ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
    note.connect(ng).connect(master); note.start(at); note.stop(at + 0.45);
  }
  master.gain.setValueAtTime(0.2, start + Math.max(0, duration - 1)); master.gain.linearRampToValueAtTime(0, start + duration);
}
/** Real-time browser encoding; reported extension always matches the actual codec container. */
export async function exportVideo(film: Film, options: ExportOptions): Promise<VideoResult> {
  const format = supportedVideoFormat();
  if (!format) throw new Error('当前浏览器不支持视频录制，请使用最新版 Chrome、Edge 或 Safari');
  if (options.signal?.aborted) throw abortError();
  if (!(film.duration > 0 && film.duration <= 120)) throw new Error('视频时长需要在 1–120 秒之间');
  const canvas = document.createElement('canvas');
  canvas.width = film.aspect === '9:16' ? 720 : film.aspect === '1:1' ? 720 : 1280;
  canvas.height = film.aspect === '9:16' ? 1280 : 720;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx || !canvas.captureStream) throw new Error('当前浏览器不支持画布视频导出');
  await document.fonts.ready;
  const asset = await loadAsset(film.assetUrl, options.signal);
  if (options.signal?.aborted) throw abortError();
  drawFilm(ctx, film, 0, { asset });
  const stream = canvas.captureStream(film.fps || 30);
  let audio: AudioContext | undefined;
  let recorder: MediaRecorder | undefined;
  let animation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  let visibility: (() => void) | undefined;
  try {
    if (options.music) {
      audio = new AudioContext(); await audio.resume();
      if (audio.state !== 'running') throw new Error('浏览器阻止了音频，请点击导出重试，或关闭背景音乐');
      const destination = audio.createMediaStreamDestination();
      destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      scheduleScore(audio, destination, film.duration);
    }
    if (options.signal?.aborted) throw abortError();
    recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 7_000_000, audioBitsPerSecond: 128_000 });
    const result = await new Promise<VideoResult>((resolve, reject) => {
      const chunks: Blob[] = []; let finished = false; let failure: Error | DOMException | undefined;
      const finish = (error?: Error | DOMException) => {
        if (finished) return; finished = true; failure = error;
        cancelAnimationFrame(animation); if (timer) clearTimeout(timer);
        if (recorder?.state !== 'inactive') recorder?.stop();
        else if (error) reject(error);
      };
      abort = () => finish(abortError());
      options.signal?.addEventListener('abort', abort, { once: true });
      visibility = () => { if (document.hidden) finish(new Error('导出已停止：请保持此页面在前台，再重新导出')); };
      document.addEventListener('visibilitychange', visibility);
      recorder!.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder!.onerror = () => finish(new Error('浏览器编码失败，请重试或换用其他浏览器'));
      recorder!.onstop = () => {
        if (failure) { reject(failure); return; }
        const blob = new Blob(chunks, { type: recorder!.mimeType || format.mime });
        if (!blob.size) { reject(new Error('未能生成视频，请重试')); return; }
        options.onProgress(1); resolve({ blob, extension: format.extension });
      };
      recorder!.start(250);
      const start = performance.now(); options.onProgress(0);
      const frame = () => {
        if (finished) return;
        const elapsed = (performance.now() - start) / 1000;
        drawFilm(ctx, film, Math.min(elapsed, film.duration - 0.001), { asset });
        options.onProgress(Math.min(0.995, elapsed / film.duration));
        if (elapsed >= film.duration) { finish(); return; }
        animation = requestAnimationFrame(frame);
      };
      animation = requestAnimationFrame(frame);
      timer = setTimeout(() => finish(new Error('导出超时，请保持页面在前台并重试')), (film.duration + 20) * 1000);
    });
    return result;
  } finally {
    cancelAnimationFrame(animation); if (timer) clearTimeout(timer);
    if (abort) options.signal?.removeEventListener('abort', abort);
    if (visibility) document.removeEventListener('visibilitychange', visibility);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream.getTracks().forEach(track => track.stop());
    if (audio && audio.state !== 'closed') await audio.close();
  }
}
