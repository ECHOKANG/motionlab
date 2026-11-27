export type AspectRatio = '16:9' | '9:16' | '1:1';
export type StyleId = 'aurora' | 'midnight' | 'citrus' | 'rose';
export type CreationMode = 'template' | 'custom';
export type SceneLayout = 'title' | 'product' | 'features' | 'metric' | 'cta' | 'custom';
export type LayerType = 'text' | 'rect' | 'ellipse' | 'line' | 'polygon' | 'image';
export type KeyframeProperty = 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity' | 'scale';
export interface LayerKeyframe { time: number; easing?: 'linear' | 'easeInOut' | 'spring'; x?: number; y?: number; width?: number; height?: number; rotation?: number; opacity?: number; scale?: number; }
// Geometry uses fractions of the canvas; font/stroke sizes use its shorter side.
export interface CustomLayer { id: string; type: LayerType; name: string; x: number; y: number; width: number; height: number; rotation: number; opacity: number; scale: number; fill: string; gradient?: {to:string; angle:number}; stroke: string; strokeWidth: number; radius: number; text?: string; fontSize?: number; fontWeight?: number; align?: 'left' | 'center' | 'right'; points?: [number,number][]; keyframes: LayerKeyframe[]; }
export interface CustomComposition { background: string; backgroundEnd?: string; layers: CustomLayer[]; }
export interface Scene { id: string; layout: SceneLayout; eyebrow: string; headline: string; body: string; items: string[]; duration: number; composition?: CustomComposition; }
export interface Film { creationMode?: CreationMode; id: string; title: string; prompt: string; aspect: AspectRatio; style: StyleId; duration: number; fps: 30; scenes: Scene[]; createdAt: string; updatedAt: string; assetUrl?: string; }
export interface AgentRequest { creationMode?: CreationMode; prompt: string; aspect: AspectRatio; style: StyleId; duration: number; film?: Film; }
export interface AgentResponse { film: Film; mode: 'model' | 'template'; message: string; decisions: string[]; }
export const STYLES: {id: StyleId; name: string; color: string; background: string; description: string}[] = [
  {id:'aurora',name:'极光紫',color:'#a08bfa',background:'#141220',description:'通透光感 · 科技新品'},
  {id:'midnight',name:'深空蓝',color:'#74c9f5',background:'#0b1829',description:'理性克制 · 产品演示'},
  {id:'citrus',name:'酸橙绿',color:'#d0f268',background:'#161d16',description:'大胆醒目 · 社交传播'},
  {id:'rose',name:'落日橘',color:'#ff9b82',background:'#2c1720',description:'温暖有趣 · 生活方式'},
];
export const dimensions = (aspect: AspectRatio, height = 720) => ({width: Math.round(aspect === '9:16' ? height*9/16 : aspect === '1:1' ? height : height*16/9), height});
