import { FIND_OWNED_ASSET } from '../../../lib/server/project-queries';
import { env } from 'cloudflare:workers';
import { validateAgentRequest,planFilm,modelSystemPrompt,customSystemPrompt,applyModelPlan,generationModeFor,CustomModelRequiredError } from '../../../lib/motion/planner';
import { json,requireUser,errorResponse,readJson,HttpError } from '../../../lib/server/http';
export async function POST(request:Request) {
  try {
    const user=await requireUser(request);
    const input=validateAgentRequest(await readJson(request,400000));
    if(input.film?.assetUrl) {
      if(!env.DB)throw new HttpError(503,'素材存储尚未配置');
      const owned=await env.DB.prepare(FIND_OWNED_ASSET).bind(user.userId,input.film.assetUrl.split('/').pop()).first();
      if(!owned)throw new HttpError(400,'素材不存在或无权使用');
    }
    const custom=input.creationMode==='custom';
    const generationMode=generationModeFor(input,!!(env.MODEL_API_KEY&&env.MODEL_BASE_URL&&env.MODEL_NAME));
    if(generationMode==='template')return json(planFilm(input));
    let endpoint:URL;
    try { endpoint=new URL(env.MODEL_BASE_URL!.replace(/\/$/,'')+'/chat/completions'); }catch{throw new HttpError(503,'模型连接配置不正确');}
    if(endpoint.protocol!=='https:') throw new HttpError(503,'模型连接须使用 HTTPS');
    let response:Response;
    try {
      // Let the provider choose its default; some models reject custom temperatures.
      response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${env.MODEL_API_KEY}`},body:JSON.stringify({model:env.MODEL_NAME,messages:[{role:'system',content:custom?customSystemPrompt:modelSystemPrompt},{role:'user',content:JSON.stringify({creationMode:input.creationMode,prompt:input.prompt,aspect:input.aspect,style:input.style,duration:input.duration,existingFilm:input.film??null})}],max_tokens:custom?12000:3000}),signal:AbortSignal.timeout(custom?90000:45000)});
    }catch {throw new HttpError(503,'模型连接超时，请稍后再试');}
    if(!response.ok) throw new HttpError(502,'模型服务暂时不可用，请检查服务端配置');
    const result=await response.json() as {choices?:{message?:{content?:string}}[]};
    const content=result.choices?.[0]?.message?.content;
    if(typeof content!=='string'||content.length>(custom?350000:50000))throw new HttpError(502,'模型返回内容不符合分镜格式');
    let raw:unknown;
    try {raw=JSON.parse(content.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw new HttpError(502,'模型没有返回有效分镜，请重试');}
    let film;
    try {film=applyModelPlan(raw,input);}catch{throw new HttpError(502,'模型分镜未通过格式检查，请重试');}
    return json({film,mode:'model',message:custom?(input.film?'已按反馈调整自由图层和动画。':'已从创意生成独立的图层动画，没有使用固定模板。'):(input.film?'已根据你的反馈调整分镜。':'已完成产品理解和分镜创作，可预览并继续调整。'),decisions:[`生成 ${film.scenes.length} 个${custom?'自由场景':'原创分镜'}`,`总时长 ${film.duration} 秒，${film.aspect} 画幅`,custom?'已校验图层、关键帧、时间线与资源上限':'已检查文字长度、场景类型和时间线一致性']});
  }catch(error){if(error instanceof CustomModelRequiredError)return json({error:error.message},503);return errorResponse(error);}
}
