import test from 'node:test';
import assert from 'node:assert/strict';
import {planFilm,validateFilm,validateAgentRequest,applyModelPlan} from '../lib/motion/planner.ts';
const request={prompt:'为「FlowNote」做一支产品短片，AI 整理笔记，自动提炼重点，跨设备同步',aspect:'16:9',style:'aurora',duration:30};
test('generates a tailored editable film with a consistent timeline',()=>{
  const result=planFilm(request);assert.equal(result.mode,'template');assert.match(result.film.title,/FlowNote/);assert.equal(result.film.scenes.length,4);assert.equal(result.film.scenes.reduce((n,s)=>n+s.duration,0),30);assert.ok(result.film.scenes.some(s=>s.items.includes('自动提炼重点')));assert.deepEqual(validateFilm(result.film).scenes,result.film.scenes);
});
test('ratio and duration edits retain scenes, identity and copy',()=>{
  const film=planFilm(request).film;
  const updated=planFilm({...request,film,prompt:'改成竖屏，30秒缩短到15秒，使用酸橙绿'}).film;
  assert.equal(updated.duration,15);assert.equal(updated.id,film.id);assert.equal(updated.aspect,'9:16');assert.equal(updated.style,'citrus');
  assert.deepEqual(updated.scenes.map(s=>s.id),film.scenes.map(s=>s.id));assert.equal(updated.scenes.reduce((n,s)=>n+s.duration,0),updated.duration);
});
test('edits the requested scene without replacing other content',()=>{
  const film=planFilm(request).film;
  const updated=planFilm({...request,film,prompt:'第3个分镜标题改为「记录灵感，不必费力」'}).film;
  assert.equal(updated.scenes[2].headline,'记录灵感，不必费力');assert.equal(updated.scenes[0].headline,film.scenes[0].headline);
});
test('unrecognized freeform revision is explicitly bounded in template mode',()=>{
  const result=planFilm({...request,film:planFilm(request).film,prompt:'换一种全新的创意，体现海浪的节奏'});assert.match(result.message,/模板模式/);assert.match(result.message,/连接模型/);
});
test('rejects URL only, oversized and invalid requests',()=>{
  assert.throws(()=>validateAgentRequest({...request,prompt:'https://example.com'}),/不会读取/);
  assert.throws(()=>validateAgentRequest({...request,prompt:'a'.repeat(4001)}),/4000/);
  assert.throws(()=>validateAgentRequest({...request,duration:300}),/时长/);
  assert.throws(()=>validateAgentRequest({...request,style:'injected'}),/风格/);
});
test('rejects model executable layout and invalid timing',()=>{
  const film=planFilm(request).film;
  assert.throws(()=>applyModelPlan({scenes:film.scenes.map((s,i)=>({...s,layout:i===0?'eval':s.layout}))},request),/布局/);
  assert.throws(()=>validateFilm({...film,scenes:film.scenes.map((s,i)=>({...s,duration:i===0?99:s.duration}))}),/时长/);
  assert.throws(()=>validateFilm({...film,scenes:film.scenes.map(s=>({...s,id:'same'}))}),/唯一/);
});
test('normalizes valid model duration and preserves existing asset',()=>{
  const film={...planFilm(request).film,assetUrl:'/api/assets/owned-asset'};
  const result=applyModelPlan({title:'新的一天',scenes:film.scenes.map(s=>({...s,duration:4}))},{...request,film});
  assert.equal(result.duration,30);assert.equal(result.scenes.reduce((n,s)=>n+s.duration,0),30);assert.equal(result.assetUrl,film.assetUrl);assert.equal(result.id,film.id);
});
test('strips external and script asset sources and unknown properties',()=>{
  const film=planFilm(request).film;const safe=validateFilm({...film,assetUrl:'javascript:alert(1)',code:'eval()'});assert.equal(safe.assetUrl,undefined);assert.equal(safe.code,undefined);
});
test('presentation-only revisions never overwrite the opening headline',()=>{
  const film=planFilm(request).film;
  for(const prompt of ['改成深空蓝','改成竖屏','改为 30 秒']) {
    const updated=planFilm({...request,film,prompt}).film;
    assert.deepEqual(updated.scenes.map(s=>s.headline),film.scenes.map(s=>s.headline));
  }
});
test('validation preserves canonical edit timestamps for stale-save protection',()=>{
  const film=planFilm(request).film;film.updatedAt='2026-01-01T10:00:00+08:00';
  assert.equal(validateFilm(film).updatedAt,'2026-01-01T02:00:00.000Z');
});
test('model revisions also apply explicit presentation changes',()=>{
  const film=planFilm(request).film;
  const updated=applyModelPlan({title:film.title,scenes:film.scenes},{...request,film,prompt:'改成深空蓝，改为 15 秒，竖屏'});
  assert.equal(updated.style,'midnight');assert.equal(updated.duration,15);assert.equal(updated.aspect,'9:16');
});
test('quoted title content does not unexpectedly change presentation',()=>{
  const film=planFilm(request).film;
  const updated=planFilm({...request,film,prompt:'开场标题改为「深空蓝，30秒的想象」'}).film;
  assert.equal(updated.style,film.style);assert.equal(updated.duration,film.duration);assert.equal(updated.scenes[0].headline,'深空蓝，30秒的想象');
});
