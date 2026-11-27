import test from 'node:test';
import assert from 'node:assert/strict';
import { drawFilm } from '../lib/motion/renderer.ts';
import { sampleLayer } from '../lib/motion/custom-renderer.ts';
const base = {id:'free-layer',name:'A free element',type:'rect',x:.1,y:.2,width:.3,height:.1,rotation:0,opacity:1,scale:1,fill:'#ffcc55',stroke:'#ffffff',strokeWidth:0,radius:.02,keyframes:[]};
const film = {id:'custom-film',creationMode:'custom',title:'Internal title must not appear',prompt:'An entirely original composition',aspect:'16:9',style:'aurora',duration:5,fps:30,createdAt:'2026-01-01',updatedAt:'2026-01-01',scenes:[{id:'scene-1',layout:'custom',eyebrow:'Not rendered',headline:'Not rendered either',body:'Not rendered',items:[],duration:5,composition:{background:'#122334',layers:[]}}]};
function recorder(width=1280,height=720){
 const calls=[]; const stack=[]; const state={canvas:{width,height},font:'16px sans-serif',globalAlpha:1};
 const context=new Proxy(state,{get(target,key){
  if(key in target)return target[key];
  if(key==='save')return ()=>{stack.push({...target});calls.push(['save']);};
  if(key==='restore')return ()=>{Object.assign(target,stack.pop());calls.push(['restore']);};
  if(key==='measureText')return value=>({width:Array.from(value).length*Number((target.font.match(/([\d.]+)px/)||[0,16])[1])*.6});
  if(key==='createLinearGradient')return (...args)=>{calls.push([key,...args]);return {addColorStop:(...v)=>calls.push(['addColorStop',...v])};};
  return (...args)=>{for(const n of args.flat())if(typeof n==='number')assert.ok(Number.isFinite(n));calls.push([key,...args]);};
 },set(target,key,value){target[key]=value;calls.push(['set',key,typeof value==='object'?'gradient':value]);return true;}});
 return {context,calls};
}
function render(f,t,options){const r=recorder();drawFilm(r.context,f,t,options);return r.calls;}
function withLayers(layers){return {...film,scenes:[{...film.scenes[0],composition:{background:'#122334',layers}}]};}

test('blank custom composition contains only its chosen background and no template decoration',()=>{
 const calls=render(film,2);
 assert.equal(calls.filter(([op])=>op==='fillRect').length,2);
 assert.ok(calls.some(([op,key,val])=>op==='set'&&key==='fillStyle'&&val==='#122334'));
 assert.ok(!calls.some(([op])=>['fillText','ellipse','arc','roundRect'].includes(op)));
 assert.deepEqual(render({...film,style:'rose',title:'Different title'},2),calls);
});
test('custom text and shape order are fully authored, with no automatic captions',()=>{
 const layers=[{...base,type:'text',text:'CUSTOM STORY',fontSize:.05,fontWeight:700,align:'center'}, {...base,id:'shape-2',type:'ellipse',x:.6}];
 const calls=render(withLayers(layers),1);
 assert.deepEqual(calls.filter(([op])=>op==='fillText').map(x=>x[1]),['CUSTOM STORY']);
 assert.ok(calls.findIndex(x=>x[0]==='fillText')<calls.findIndex(x=>x[0]==='ellipse'));
});
test('keyframes interpolate per property, hold values, and produce identical pixels after reverse seeking',()=>{
 const layer={...base,keyframes:[{time:1,x:.5,easing:'linear'},{time:2,opacity:0,easing:'linear'},{time:3,x:.9,easing:'linear'}]};
 assert.equal(sampleLayer(layer,0).x,.1);
 assert.ok(Math.abs(sampleLayer(layer,.5).x-.3)<1e-12);
 assert.equal(sampleLayer(layer,1).x,.5);
 assert.equal(sampleLayer(layer,2).x,.7);
 assert.equal(sampleLayer(layer,4).x,.9);
 assert.equal(sampleLayer(layer,1).opacity,.5);
 assert.equal(sampleLayer(layer,4).opacity,0);
 assert.equal(sampleLayer({...base,keyframes:[{time:0,x:.8},{time:1,x:.4,easing:'linear'}]},0).x,.8);
 const f=withLayers([layer]); const expected=render(f,.8);render(f,4);render(f,.1);assert.deepEqual(render(f,.8),expected);
});
test('all primitive layers render finite geometry across ratios and optional source images',()=>{
 const layers=['rect','ellipse','line','polygon','text','image'].map((type,i)=>({...base,id:'primitive-'+i,type,points:[[.5,0],[1,1],[0,1]],text:'每一个想法\n都可以自由生长',fontSize:.04,width:.4,height:.25,strokeWidth:.002,gradient:{to:'#7733ee',angle:45},keyframes:[{time:0,opacity:0,scale:.2},{time:2,opacity:1,scale:1,rotation:30,easing:'spring'}]}));
 for(const aspect of ['16:9','9:16','1:1'])for(const t of [0,.4,1.9,4.999,Infinity,-3])assert.ok(render({...withLayers(layers),aspect},t).length);
 const calls=render(withLayers(layers),2,{asset:{complete:true,naturalWidth:640,naturalHeight:480}});
 assert.ok(calls.some(([op])=>op==='drawImage'));
 assert.ok(!render(withLayers([{...base,type:'image'}]),2).some(([op])=>op==='drawImage'));
});
test('scene boundaries use each scene background and local keyframe clock with a deliberate cut',()=>{
 const second={...film.scenes[0],id:'scene-2',composition:{background:'#ff0000',layers:[{...base,type:'text',text:'SECOND',fontSize:.05,keyframes:[{time:0,x:0},{time:1,x:1,easing:'linear'}]}]}};
 const f={...film,duration:10,scenes:[film.scenes[0],second]};
 assert.ok(!render(f,4.99).some(x=>x[0]==='fillText'));
 const start=render(f,5);assert.ok(start.some(x=>x[0]==='fillText'&&x[1]==='SECOND'));assert.ok(start.some(x=>x[0]==='set'&&x[1]==='fillStyle'&&x[2]==='#ff0000'));
 const middle=render(f,5.5);assert.ok(middle.some(x=>x[0]==='translate'&&x[1]===1280*.5+1280*.3/2));
});

test('horizontal and vertical lines retain a visible stroke with one zero dimension',()=>{
 for (const dimensions of [{width:.5,height:0},{width:0,height:.5}]) {
  const calls=render(withLayers([{...base,...dimensions,type:'line',strokeWidth:.004}]),1);
  assert.ok(calls.some(x=>x[0]==='stroke'));
 }
});

test('transparent custom backgrounds composite onto the same opaque base in previews and videos',()=>{
 const f={...film,scenes:[{...film.scenes[0],composition:{background:'#ff000080',layers:[]}}]};
 const calls=render(f,1);
 const paints=calls.filter(x=>x[0]==='set'&&x[1]==='fillStyle').map(x=>x[2]);
 assert.deepEqual(paints,['#000000','#ff000080']);
});
