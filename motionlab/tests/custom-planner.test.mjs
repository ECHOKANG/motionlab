import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFilm,validateAgentRequest,applyModelPlan,planFilm,generationModeFor,CustomModelRequiredError} from '../lib/motion/planner.ts';

const request={creationMode:'custom',prompt:'让一轮红日缓缓升起，用自由图形讲述一天的开始',aspect:'16:9',style:'aurora',duration:15};
const layer=(overrides={})=>({id:'sun',type:'ellipse',name:'太阳',x:0.4,y:0.5,width:0.2,height:0.3,rotation:0,opacity:1,scale:1,fill:'#ff6655',stroke:'#00000000',strokeWidth:0,radius:0,keyframes:[{time:0,y:0.9},{time:15,y:0.1}],...overrides});
const scene=(overrides={})=>({id:'sunrise',layout:'custom',headline:'日出',eyebrow:'',body:'自由构图',items:[],duration:15,composition:{background:'#112244',layers:[layer()]},...overrides});
const film=(overrides={})=>({id:'custom-test',creationMode:'custom',title:'一天的开始',prompt:request.prompt,aspect:'16:9',style:'aurora',duration:15,fps:30,scenes:[scene()],createdAt:'2026-11-23T00:00:00Z',updatedAt:'2026-11-23T00:00:00Z',...overrides});
const withLayer=value=>film({scenes:[scene({composition:{background:'#112244',layers:[value]}})]});

test('custom single-scene and blank canvases persist without template defaults',()=>{
  const saved=validateFilm(film());assert.equal(saved.creationMode,'custom');assert.equal(saved.scenes.length,1);assert.equal(saved.scenes[0].composition.layers[0].type,'ellipse');
  const blank=validateFilm(film({scenes:[scene({composition:{background:'#000000',layers:[]}})]}));assert.deepEqual(blank.scenes[0].composition.layers,[]);
  assert.equal(validateFilm({...film(),creationMode:undefined}).creationMode,'custom');
});

test('custom AI requires a model and never uses the template fallback',()=>{
  assert.throws(()=>generationModeFor(request,false),error=>error instanceof CustomModelRequiredError&&error.status===503&&/空白画布/.test(error.message));
  assert.throws(()=>planFilm(request),CustomModelRequiredError);
  assert.throws(()=>planFilm({...request,creationMode:undefined,film:film()}),CustomModelRequiredError);
  assert.equal(generationModeFor(request,true),'model');assert.equal(generationModeFor({...request,creationMode:'template'},false),'template');
});

test('editing infers custom mode but rejects switching an existing film to templates',()=>{
  assert.equal(validateAgentRequest({...request,creationMode:undefined,film:film()}).creationMode,'custom');
  assert.throws(()=>validateAgentRequest({...request,creationMode:'template',film:film()}),/切换/);
  assert.throws(()=>validateFilm(film({scenes:[scene({layout:'title'})]})),/混用/);
  assert.throws(()=>validateFilm(film({creationMode:'template',scenes:[scene(),scene({id:'2'}),scene({id:'3'})]})),/混用/);
});

test('custom model output preserves authored geometry and narrative rather than adding stock scenes',()=>{
  const result=applyModelPlan({title:'太阳的轨迹',scenes:[scene()]},request);
  assert.equal(result.title,'太阳的轨迹');assert.equal(result.scenes.length,1);assert.equal(result.creationMode,'custom');
  assert.deepEqual(result.scenes[0].composition,film().scenes[0].composition);
  assert.throws(()=>applyModelPlan({scenes:[scene({layout:'product'})]},request),/模板/);
  assert.throws(()=>applyModelPlan({scenes:[scene({composition:{background:'#000000',layers:[]}})]},request),/空白/);
});

test('custom model edits retain project identity and asset while scaling animation time',()=>{
  const existing=film({assetUrl:'/api/assets/owned-asset'});
  const result=applyModelPlan({scenes:[scene()]},{...request,film:existing,prompt:'改为 30 秒，并改成竖屏'});
  assert.equal(result.id,existing.id);assert.equal(result.assetUrl,existing.assetUrl);assert.equal(result.duration,30);assert.equal(result.aspect,'9:16');
  assert.equal(result.scenes[0].composition.layers[0].keyframes[1].time,30);
  assert.equal(result.scenes[0].composition.layers[0].keyframes[1].y,0.1);
  assert.equal(result.scenes[0].composition.background,'#112244');
});

test('unsafe code, network sources, invalid types and nonfinite geometry cannot enter compositions',()=>{
  const safe=validateFilm(withLayer(layer({code:'fetch(secret)',url:'https://untrusted.example/image',onclick:'eval()',gradient:{to:'#00ffaa',angle:45,code:'eval()'}})));
  const saved=safe.scenes[0].composition.layers[0];assert.equal(saved.code,undefined);assert.equal(saved.url,undefined);assert.equal(saved.onclick,undefined);assert.equal(saved.gradient.code,undefined);
  for(const patch of [{type:'javascript'},{x:Infinity},{opacity:2},{fill:'url(https://untrusted.example)'},{strokeWidth:1},{gradient:{to:'#fff',angle:NaN}}])assert.throws(()=>validateFilm(withLayer(layer(patch))));
});

test('keyframes must be bounded, strictly ordered and unique',()=>{
  for(const keyframes of [[{time:-1,x:0}],[{time:16,x:0}],[{time:5,x:0},{time:2,x:1}],[{time:2},{time:2}],[{time:0,scale:Infinity}],[{time:0,easing:'eval'}]])assert.throws(()=>validateFilm(withLayer(layer({keyframes}))));
  assert.throws(()=>validateFilm(withLayer(layer({keyframes:Array.from({length:25},(_,i)=>({time:i/2}))}))),/24/);
});

test('custom shape and text structures reject oversized or invalid payloads',()=>{
  assert.throws(()=>validateFilm(withLayer(layer({type:'polygon',points:[[0,0],[1,1]]}))),/顶点/);
  assert.throws(()=>validateFilm(withLayer(layer({type:'polygon',points:[[0,0],[1,1],[NaN,0]]}))));
  assert.throws(()=>validateFilm(withLayer(layer({type:'text',text:'x'.repeat(601)}))),/600/);
  assert.throws(()=>validateFilm(withLayer(layer({type:'text',text:'Hello',fontSize:4}))),/字号/);
  assert.throws(()=>validateFilm(film({scenes:[scene({composition:{background:'#000',layers:[layer(),layer()]}})]})),/唯一/);
});

test('per-scene and total resource budgets apply across the entire film',()=>{
  const makeScene=(id,count,duration=3)=>scene({id,duration,composition:{background:'#000000',layers:Array.from({length:count},(_,i)=>layer({id:'layer-'+i,keyframes:[]}))}});
  assert.throws(()=>validateFilm(film({scenes:[makeScene('one',41,15)]})),/40/);
  assert.throws(()=>validateFilm(film({duration:21,scenes:Array.from({length:7},(_,i)=>makeScene('scene-'+i,40))})),/240/);
  const dense=Array.from({length:4},(_,i)=>makeScene('dense-'+i,30,3.75));
  dense.forEach(s=>s.composition.layers.forEach(l=>l.keyframes=Array.from({length:24},(_,i)=>({time:i/24*3.75,opacity:1}))));
  assert.throws(()=>validateFilm(film({scenes:dense})),/2000/);
});

test('model normalization assigns missing identifiers but rejects invalid authored keyframes',()=>{
  const input=scene();delete input.id;delete input.composition.layers[0].id;
  const result=applyModelPlan({scenes:[input]},request);assert.match(result.scenes[0].id,/^[a-zA-Z0-9_-]+$/);assert.match(result.scenes[0].composition.layers[0].id,/^[a-zA-Z0-9_-]+$/);
  const invalid=scene({duration:5});assert.throws(()=>applyModelPlan({scenes:[invalid]},request),/关键帧时间/);
});

test('custom model normalization respects minimum scene duration when compressing unequal scenes',()=>{
 const result=applyModelPlan({scenes:[scene({duration:.5,composition:{background:'#000',layers:[layer({keyframes:[{time:0,y:0},{time:.5,y:1}]})]}}),scene({id:'long',duration:59.5,composition:{background:'#fff',layers:[]}})]},request);
 assert.equal(result.scenes[0].duration,.5);
 assert.equal(result.scenes[1].duration,14.5);
 assert.equal(result.scenes[0].composition.layers[0].keyframes[1].time,.5);
});
