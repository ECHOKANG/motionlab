import type { CustomComposition, CustomLayer, KeyframeProperty, LayerKeyframe, LayerType } from './types';

export class CustomValidationError extends Error { status = 400; }
export const CUSTOM_LIMITS = { scenes: 12, layersPerScene: 40, layersPerFilm: 240, keyframesPerLayer: 24, keyframesPerFilm: 2000 } as const;
const properties: KeyframeProperty[] = ['x','y','width','height','rotation','opacity','scale'];
const ranges: Record<KeyframeProperty,[number,number]> = {x:[-2,3],y:[-2,3],width:[0,4],height:[0,4],rotation:[-3600,3600],opacity:[0,1],scale:[0,8]};
const types: LayerType[] = ['text','rect','ellipse','line','polygon','image'];
const idPattern = /^[a-zA-Z0-9_-]{1,100}$/;
const isObject = (v: unknown): v is Record<string,unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const stringValue = (v:unknown,max:number,fallback='') => typeof v === 'string' ? v.slice(0,max) : fallback;
function finite(v:unknown,min:number,max:number,label:string):number {
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new CustomValidationError(`${label}须为 ${min}–${max} 范围的有限数值`);
  return v;
}
export function customColor(v:unknown,label='图层颜色'):string {
  if(typeof v!=='string'||!/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(v))throw new CustomValidationError(`${label}须使用十六进制颜色`);
  return v;
}
function validateKeyframes(value:unknown,duration:number):LayerKeyframe[] {
  if(!Array.isArray(value)||value.length>CUSTOM_LIMITS.keyframesPerLayer)throw new CustomValidationError('每个图层最多 24 个关键帧');
  let previous=-1;
  return value.map((raw):LayerKeyframe=>{
    if(!isObject(raw))throw new CustomValidationError('关键帧格式不正确');
    const time=finite(raw.time,0,duration,'关键帧时间');
    if(time<=previous)throw new CustomValidationError('关键帧时间必须递增且唯一');
    previous=time;
    if(raw.easing!==undefined&&!['linear','easeInOut','spring'].includes(raw.easing as string))throw new CustomValidationError('关键帧缓动类型不正确');
    const result:LayerKeyframe={time,...(raw.easing?{easing:raw.easing as LayerKeyframe['easing']}:{})};
    for(const key of properties)if(raw[key]!==undefined)result[key]=finite(raw[key],...ranges[key],`关键帧 ${key}`);
    return result;
  });
}
export function validateCustomComposition(value:unknown,duration:number):CustomComposition {
  if(!isObject(value)||!Array.isArray(value.layers)||value.layers.length>CUSTOM_LIMITS.layersPerScene)throw new CustomValidationError('自由画面须包含图层数组，每幕最多 40 个图层');
  const seen=new Set<string>();
  const layers=value.layers.map((raw):CustomLayer=>{
    if(!isObject(raw)||typeof raw.id!=='string'||!idPattern.test(raw.id)||seen.has(raw.id))throw new CustomValidationError('图层 ID 必须有效且在分镜内唯一');
    seen.add(raw.id);
    if(!types.includes(raw.type as LayerType))throw new CustomValidationError('不支持的自由图层类型');
    const layer:CustomLayer={
      id:raw.id,type:raw.type as LayerType,name:stringValue(raw.name,80,raw.type as string),
      x:finite(raw.x,...ranges.x,'图层 x'),y:finite(raw.y,...ranges.y,'图层 y'),
      width:finite(raw.width,...ranges.width,'图层宽度'),height:finite(raw.height,...ranges.height,'图层高度'),
      rotation:finite(raw.rotation??0,...ranges.rotation,'图层旋转'),opacity:finite(raw.opacity??1,...ranges.opacity,'图层不透明度'),scale:finite(raw.scale??1,...ranges.scale,'图层缩放'),
      fill:customColor(raw.fill??'#ffffff'),stroke:customColor(raw.stroke??'#00000000'),strokeWidth:finite(raw.strokeWidth??0,0,0.1,'描边宽度'),radius:finite(raw.radius??0,0,1,'圆角'),
      keyframes:validateKeyframes(raw.keyframes??[],duration),
    };
    if(raw.gradient!==undefined){if(!isObject(raw.gradient))throw new CustomValidationError('渐变格式不正确');layer.gradient={to:customColor(raw.gradient.to),angle:finite(raw.gradient.angle??0,-3600,3600,'渐变角度')};}
    if(layer.type==='text'){
      if(typeof raw.text!=='string'||raw.text.length>600)throw new CustomValidationError('文字图层最多 600 字');
      if(raw.align!==undefined&&!['left','center','right'].includes(raw.align as string))throw new CustomValidationError('文字对齐方式不正确');
      layer.text=raw.text;layer.fontSize=finite(raw.fontSize??0.08,0.005,0.5,'字号');layer.fontWeight=finite(raw.fontWeight??600,100,900,'字重');layer.align=(raw.align??'left') as CustomLayer['align'];
    }
    if(layer.type==='polygon'){
      if(!Array.isArray(raw.points)||raw.points.length<3||raw.points.length>32)throw new CustomValidationError('多边形需要 3–32 个顶点');
      layer.points=raw.points.map((point):[number,number]=>{if(!Array.isArray(point)||point.length!==2)throw new CustomValidationError('多边形顶点格式不正确');return [finite(point[0],0,1,'顶点 x'),finite(point[1],0,1,'顶点 y')];});
    }
    return layer;
  });
  return {background:customColor(value.background,'背景色'),...(value.backgroundEnd!==undefined?{backgroundEnd:customColor(value.backgroundEnd,'背景渐变色')}:{}),layers};
}
export function checkCustomFilmLimits(compositions:CustomComposition[]):void {
  const layers=compositions.flatMap(c=>c.layers);
  if(layers.length>CUSTOM_LIMITS.layersPerFilm)throw new CustomValidationError('每部作品最多 240 个自由图层');
  if(layers.reduce((sum,l)=>sum+l.keyframes.length,0)>CUSTOM_LIMITS.keyframesPerFilm)throw new CustomValidationError('每部作品最多 2000 个关键帧');
}
