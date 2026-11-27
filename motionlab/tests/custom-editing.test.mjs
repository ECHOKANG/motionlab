import test from 'node:test';
import assert from 'node:assert/strict';
import {createBlankFilm,createBlankScene,createLayer,resizeCustomScenes,animateLayer} from '../lib/motion/custom.ts';
import {validateFilm} from '../lib/motion/planner.ts';

function animatedScene(duration,name='Scene'){
 const scene=createBlankScene(duration,name);
 scene.composition.layers=[animateLayer(createLayer('rect'),'drift',duration)];
 return scene;
}
function assertValidTiming(scenes,duration){
 assert.ok(Math.abs(scenes.reduce((sum,s)=>sum+s.duration,0)-duration)<1e-9);
 assert.ok(scenes.every(s=>s.duration>=.5));
 for(const scene of scenes)for(const layer of scene.composition.layers){
  let previous=-1;
  for(const frame of layer.keyframes){assert.ok(frame.time>=0&&frame.time<=scene.duration);assert.ok(frame.time>previous);previous=frame.time;}
 }
 validateFilm({...createBlankFilm('16:9',duration),scenes});
}
test('shortening a custom film preserves the half-second scene floor and scales its keyframes',()=>{
 const scenes=[animatedScene(.5,'Short'),animatedScene(59.5,'Long')];
 const resized=resizeCustomScenes(scenes,15);
 assert.deepEqual(resized.map(s=>s.duration),[.5,14.5]);
 assert.equal(resized[1].composition.layers[0].keyframes.at(-1).time,14.5);
 assertValidTiming(resized,15);
 const mixed=resizeCustomScenes([animatedScene(.5),animatedScene(1),animatedScene(58.5)],15);
 assert.deepEqual(mixed.map(s=>s.duration),[.5,.5,14]);
 assertValidTiming(mixed,15);
});
test('unclamped scenes retain proportional pacing and rounded totals across scene counts',()=>{
 const uneven=resizeCustomScenes([animatedScene(3),animatedScene(9),animatedScene(18)],60);
 assert.deepEqual(uneven.map(s=>s.duration),[6,18,36]);
 for(let count=1;count<=12;count++)for(const duration of [15,30,60]){
  const scenes=Array.from({length:count},(_,i)=>animatedScene(i===0?.5:i+1));
  assertValidTiming(resizeCustomScenes(scenes,duration),duration);
 }
});
test('adding and removing scenes keeps total duration and valid animation endpoints',()=>{
 let scenes=[animatedScene(.5),animatedScene(14.5)];
 while(scenes.length<12){
  scenes=resizeCustomScenes([...scenes,createBlankScene(15/scenes.length)],15);
  assertValidTiming(scenes,15);
 }
 while(scenes.length>1){scenes=resizeCustomScenes(scenes.slice(1),15);assertValidTiming(scenes,15);}
 assert.equal(scenes[0].duration,15);
});
test('all authored layer types and animation presets survive project validation',()=>{
 for(const type of ['text','rect','ellipse','line','polygon','image'])for(const preset of ['none','fade','rise','drift','pulse'])for(const duration of [.5,1.875,15,60]){
  const scene=createBlankScene(duration);
  scene.composition.layers=[animateLayer(createLayer(type),preset,duration)];
  const scenes=duration<5?[scene,createBlankScene(5-duration)]:[scene];
  const film=validateFilm({...createBlankFilm('16:9',Math.max(5,duration)),scenes});
  assert.equal(film.scenes[0].composition.layers[0].keyframes.length,preset==='none'?0:preset==='pulse'?3:2);
 }
});
test('resizing and presets do not mutate prior project snapshots',()=>{
 const scenes=[animatedScene(7.5),animatedScene(7.5)];
 const original=structuredClone(scenes);
 const resized=resizeCustomScenes(scenes,30);
 assert.deepEqual(scenes,original);
 assert.notEqual(resized,scenes);
 assert.notEqual(resized[0],scenes[0]);
 assert.notEqual(resized[0].composition,scenes[0].composition);
 assert.notEqual(resized[0].composition.layers[0].keyframes[0],scenes[0].composition.layers[0].keyframes[0]);
 const previous=structuredClone(scenes[0].composition.layers[0]);
 animateLayer(scenes[0].composition.layers[0],'pulse',15);
 assert.deepEqual(scenes[0].composition.layers[0],previous);
});
test('impossible scene budgets fail explicitly instead of generating unsaveable durations',()=>{
 assert.throws(()=>resizeCustomScenes([createBlankScene(1),createBlankScene(1)],.75),/0.5/);
 assert.throws(()=>resizeCustomScenes([createBlankScene(0)],15),/0.5/);
 assert.deepEqual(resizeCustomScenes([],15),[]);
});
