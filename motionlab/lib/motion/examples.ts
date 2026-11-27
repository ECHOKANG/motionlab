import type { Film, StyleId, SceneLayout } from './types';
export const EXAMPLES: {id:string; title:string; subtitle:string; category:string; tag:string; film:Film}[] = [
 {id:'luma', title:'让好想法，自由生长', subtitle:'产品发布 · 极简科技', category:'产品宣传',tag:'人气模板', film: make('luma','Luma · 让灵感发生','aurora',['让灵感，\n不止于想象。','每一个好想法，\n都有自己的空间。','少一点忙碌。\n多一点创造。','从灵感到行动，\n快人一步。','下一个好想法，\n从 Luma 开始。'],['为创作者而生的灵感工作台','收集、整理、协作，一处完成','灵感收藏|智能整理|轻松协作','让创作更从容，让灵感更有序','即刻开启你的创作之旅'])},
 {id:'form', title:'把日常，变成热爱', subtitle:'生活方式 · 温暖叙事',category:'社交短视频',tag:'9:16 竖屏',film: make('form','FORM · 找回你的节奏','rose',['停一停。\n听见自己的节奏。','运动，可以\n刚刚好。','为每一种你，\n找到一种热爱。','每天一点，\n改变就会发生。','今天，\n为自己出发。'],['属于你的轻运动日常','跟随 FORM，开启每日运动计划','舒展身体|积蓄能量|自在呼吸','不急着抵达，享受每一次进步','FORM · Move at your own pace'])},
 {id:'flux',title:'新鲜事，正在发生',subtitle:'上新预告 · 高能节奏',category:'活动推广',tag:'热门风格',film:make('flux','FLUX · 创意没有边界','citrus',['HELLO,\nNEW IDEAS.','你的创意，\n值得一个大舞台。','让每一次表达，\n都自带光芒。','准备好，\n突破想象了吗？','MAKE\nYOUR MOVE.'],['新一季创意计划，即将登场','全新 FLUX 创作系列','新灵感|新玩法|新可能','用你的方式定义下一次流行','现在，加入这场创意实验'])},
 {id:'orbit',title:'复杂的事，简单做好',subtitle:'功能演示 · 数据可视化',category:'产品宣传',tag:'精选',film:make('orbit','Orbit · 让工作有序运转','midnight',['让工作，\n回到清晰。','所有进展，\n一眼看见。','把注意力，\n留给重要的事。','更清晰的计划。\n更从容的团队。','下一站，\n更好的工作方式。'],['Orbit，一站式团队工作空间','项目、任务、进度，在这里连接','清晰计划|实时协作|轻松交付','从忙碌走向高效，从想法走向完成','开启 Orbit，找到你的工作节奏'])}
];
function make(id:string,title:string,style:StyleId,headlines:string[],bodies:string[]):Film {
 const layouts: SceneLayout[]=['title','product','features','metric','cta'];
 return {id:'example-'+id,title,prompt:title,aspect:'16:9',style,duration:15,fps:30,createdAt:'2026-11-23T00:00:00Z',updatedAt:'2026-11-23T00:00:00Z',scenes:headlines.map((headline,i)=>({id:id+'-'+i,layout:layouts[i],eyebrow:i===0?'INTRODUCING '+title.split(' · ')[0]:['','MADE FOR YOU','LESS, BUT BETTER','A NEW PERSPECTIVE','START SOMETHING GREAT'][i],headline,body:bodies[i].includes('|')?'为更好的创作体验而设计':bodies[i],items:bodies[i].includes('|')?bodies[i].split('|'):['灵感','创造','连接'],duration:3}))};
}
export function freshExample(example:Film,aspect=example.aspect):Film {return {...structuredClone(example),id:crypto.randomUUID(),aspect,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};}
