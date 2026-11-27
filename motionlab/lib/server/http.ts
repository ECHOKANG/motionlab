import { getChatGPTUser } from '../../app/chatgpt-auth';
export class HttpError extends Error { constructor(public status:number,message:string) {super(message);} }
export async function requireUser(request?:Request) {
  if(request && !['GET','HEAD','OPTIONS'].includes(request.method)) {
    const origin=request.headers.get('origin');
    if((origin && origin!==new URL(request.url).origin) || request.headers.get('sec-fetch-site')==='cross-site') throw new HttpError(403,'不允许跨站提交请求');
  }
  const user=await getChatGPTUser();
  if (!user) throw new HttpError(401,'请先登录后再使用创作工作台');
  return user;
}
export function json(value:unknown,status=200) {return Response.json(value,{status,headers:{'Cache-Control':'no-store'}});}
export function errorResponse(error:unknown) {
  const status=error&&typeof error==='object'&&'status' in error?Number(error.status):500;
  return json({error:status>=500?'服务暂时不可用，请稍后重试':error instanceof Error?error.message:'请求失败'},status);
}
export async function readJson(request:Request,limit=100000) {
  const length=Number(request.headers.get('content-length')??0);
  if (length>limit) throw new HttpError(413,'请求内容过大');
  const reader=request.body?.getReader();if (!reader) throw new HttpError(400,'请求内容为空');
  const chunks:Uint8Array[]=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new HttpError(413,'请求内容过大');}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new HttpError(400,'JSON 格式不正确');}
}
export const validId=(id:string)=>/^[a-zA-Z0-9_-]{1,100}$/.test(id);
