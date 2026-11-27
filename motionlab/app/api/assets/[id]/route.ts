import { env } from 'cloudflare:workers';
import { requireUser,errorResponse,HttpError,validId } from '../../../../lib/server/http';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  try {const user=await requireUser();const {id}=await context.params;if(!validId(id))throw new HttpError(404,'素材不存在');if(!env.DB||!env.BUCKET)throw new HttpError(503,'素材存储尚未配置');const asset=await env.DB.prepare('SELECT mime_type FROM assets WHERE user_id = ? AND id = ?').bind(user.userId,id).first<{mime_type:string}>();if(!asset)throw new HttpError(404,'素材不存在');const object=await env.BUCKET.get(`${user.userId}/${id}`);if(!object)throw new HttpError(404,'素材不存在');return new Response(object.body,{headers:{'Content-Type':asset.mime_type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'}});}catch(e){return errorResponse(e);}
}
export async function DELETE(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const user=await requireUser(request);const {id}=await context.params;
    if(!validId(id))throw new HttpError(404,'素材不存在');
    if(!env.DB||!env.BUCKET)throw new HttpError(503,'素材存储尚未配置');
    const asset=await env.DB.prepare('SELECT id FROM assets WHERE user_id = ? AND id = ?').bind(user.userId,id).first();
    if(!asset)throw new HttpError(404,'素材不存在');
    const reference=await env.DB.prepare("SELECT id FROM projects WHERE user_id = ? AND json_extract(film, '$.assetUrl') = ? LIMIT 1").bind(user.userId,`/api/assets/${id}`).first();
    if(reference)throw new HttpError(409,'素材正在被作品使用，请先移除作品中的引用');
    await env.BUCKET.delete(`${user.userId}/${id}`);
    await env.DB.prepare('DELETE FROM assets WHERE user_id = ? AND id = ?').bind(user.userId,id).run();
    return Response.json({deleted:true},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return errorResponse(e);}
}
