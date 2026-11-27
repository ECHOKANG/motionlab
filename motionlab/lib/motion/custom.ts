import type {AspectRatio,CustomComposition,CustomLayer,Film,LayerType,Scene,StyleId} from './types';
export const CUSTOM_LAYER_LIMIT=40;
export const CUSTOM_SCENE_LIMIT=12;
export function blankComposition():CustomComposition{return {background:'#121321',layers:[]};}
export function createBlankScene(duration:number,name='自由场景'):Scene{return {id:crypto.randomUUID(),layout:'custom',headline:name,eyebrow:'',body:'',items:[],duration,composition:blankComposition()};}
export function createBlankFilm(aspect:AspectRatio='16:9',duration=15,style:StyleId='aurora',prompt=''):Film{
 const now=new Date().toISOString();return {id:crypto.randomUUID(),creationMode:'custom',title:'我的自由创作',prompt,aspect,style,duration,fps:30,createdAt:now,updatedAt:now,scenes:[createBlankScene(duration,'场景 1')]};
}
export function createLayer(type:LayerType):CustomLayer{
 const names={text:'文字',rect:'矩形',ellipse:'圆形',line:'线条',polygon:'三角形',image:'图片'};
 return {id:crypto.randomUUID(),type,name:names[type],x:type==='text'?.12:.35,y:type==='text'?.24:.3,width:type==='text'?.76:.3,height:type==='text'?.28:type==='line'?.005:.35,rotation:0,opacity:1,scale:1,fill:type==='text'?'#ffffff':'#a28bfa',stroke:'#ffffff',strokeWidth:0,radius:type==='rect'?.025:0,text:type==='text'?'写下你的想法':undefined,fontSize:type==='text'?.09:undefined,fontWeight:type==='text'?600:undefined,align:'center',points:type==='polygon'?[[.5,0],[1,1],[0,1]]:undefined,keyframes:[]};
}
export function resizeCustomScenes(scenes:Scene[],duration:number):Scene[]{
 if(!scenes.length)return [];
 const precision=10000,minimumTicks=5000,targetTicks=Math.round(duration*precision);
 if(!Number.isFinite(duration)||duration<scenes.length*.5||scenes.some(scene=>!Number.isFinite(scene.duration)||scene.duration<=0))throw new RangeError('每个场景至少需要 0.5 秒，请增加总时长或减少场景');
 const ticks=new Array<number>(scenes.length).fill(0);
 let active=scenes.map((_,i)=>i),remaining=targetTicks;
 // Freeze scenes that hit the lower bound, then divide the remaining budget
 // proportionally among the other scenes. This preserves unequal pacing.
 while(active.length){
  const weight=active.reduce((sum,i)=>sum+scenes[i].duration,0);
  const fixed=active.filter(i=>remaining*scenes[i].duration/weight<minimumTicks);
  if(fixed.length){
   for(const i of fixed){ticks[i]=minimumTicks;remaining-=minimumTicks;}
   const fixedSet=new Set(fixed);active=active.filter(i=>!fixedSet.has(i));continue;
  }
  const fractions=active.map(i=>{const exact=remaining*scenes[i].duration/weight;const whole=Math.max(minimumTicks,Math.floor(exact));ticks[i]=whole;return {i,fraction:exact-whole};});
  const remainder=remaining-active.reduce((sum,i)=>sum+ticks[i],0);
  fractions.sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
  for(let i=0;i<remainder;i++)ticks[fractions[i%fractions.length].i]++;
  break;
 }
 return scenes.map((scene,i)=>{
  const next=ticks[i]/precision,ratio=next/scene.duration;
  return {...scene,duration:next,...(scene.composition?{composition:{...scene.composition,layers:scene.composition.layers.map(layer=>({...layer,keyframes:layer.keyframes.map(frame=>({...frame,time:Math.min(next,Math.max(0,frame.time*ratio))}))}))}}:{})};
 });
}
export function animateLayer(layer:CustomLayer,preset:'none'|'fade'|'rise'|'drift'|'pulse',duration:number):CustomLayer{
 const base={x:layer.x,y:layer.y,opacity:layer.opacity,scale:layer.scale,rotation:layer.rotation};
 const enter=Math.min(1,duration*.25);
 const frames=preset==='none'?[]:preset==='fade'?[{time:0,...base,opacity:0},{time:enter,...base}]:preset==='rise'?[{time:0,...base,y:Math.min(2,layer.y+.14),opacity:0},{time:enter,...base,easing:'spring' as const}]:preset==='drift'?[{time:0,...base,x:Math.max(-2,layer.x-.1)},{time:duration,...base,x:Math.min(2,layer.x+.1),easing:'linear' as const}]:[{time:0,...base},{time:duration/2,...base,scale:Math.min(4,layer.scale*1.2)},{time:duration,...base}];
 return {...layer,keyframes:frames};
}
