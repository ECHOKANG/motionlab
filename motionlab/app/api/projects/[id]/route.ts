import { DELETE_PROJECT } from '../../../../lib/server/project-queries';
import { env } from 'cloudflare:workers';
import { json,requireUser,errorResponse,HttpError,validId } from '../../../../lib/server/http';
export async function DELETE(_request:Request,context:{params:Promise<{id:string}>}) {
  try {const user=await requireUser(_request);const {id}=await context.params;if(!validId(id))throw new HttpError(400,'项目 ID 无效');if(!env.DB)throw new HttpError(503,'项目存储尚未配置');const result=await env.DB.prepare(DELETE_PROJECT).bind(user.userId,id).run();if(!result.meta.changes)throw new HttpError(404,'项目不存在');return json({deleted:true});}catch(e){return errorResponse(e);}
}
