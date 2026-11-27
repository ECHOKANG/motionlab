import { LIST_PROJECTS,FIND_PROJECT,UPSERT_PROJECT,FIND_OWNED_ASSET } from '../../../lib/server/project-queries';
import { env } from 'cloudflare:workers';
import { validateFilm } from '../../../lib/motion/planner';
import { json,requireUser,errorResponse,readJson,HttpError } from '../../../lib/server/http';
export async function GET() {
  try {const user=await requireUser();if(!env.DB)throw new HttpError(503,'项目存储尚未配置');const result=await env.DB.prepare(LIST_PROJECTS).bind(user.userId).all<{film:string}>();return json({projects:result.results.map(row=>JSON.parse(row.film))});}catch(e){return errorResponse(e);}
}
export async function POST(request:Request) {
  try {
    const user=await requireUser(request);
    if(!env.DB)throw new HttpError(503,'项目存储尚未配置');
    const body=await readJson(request,400000);
    if(!body||typeof body!=='object')throw new HttpError(400,'视频项目格式不正确');
    const film=validateFilm(body.film);
    if(Date.parse(film.updatedAt)>Date.now()+5*60*1000)throw new HttpError(400,'设备时间不正确，请校准后重试');
    if(film.assetUrl){const assetId=film.assetUrl.split('/').pop();const asset=await env.DB.prepare(FIND_OWNED_ASSET).bind(user.userId,assetId).first();if(!asset)throw new HttpError(400,'素材不存在或无权使用');}
    const serialized=JSON.stringify(film);
    const result=await env.DB.prepare(UPSERT_PROJECT).bind(user.userId,film.id,film.title,serialized,film.createdAt,film.updatedAt).run();
    if(!result.meta.changes){
      const existing=await env.DB.prepare(FIND_PROJECT).bind(user.userId,film.id).first<{film:string}>();
      if(existing?.film!==serialized)throw new HttpError(409,'此作品已有更新版本，请重新打开作品后编辑');
    }
    return json({film,saved:true});
  }catch(e){return errorResponse(e);}
}
