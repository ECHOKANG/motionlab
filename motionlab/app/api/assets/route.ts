import { env } from 'cloudflare:workers';
import { json,requireUser,errorResponse,HttpError } from '../../../lib/server/http';
const LIMIT=8*1024*1024;
function sniff(bytes:Uint8Array) {
  if(bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a)return 'image/png';
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
  if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'image/webp';
  return null;
}
export async function POST(request:Request) {
  try {
    const user=await requireUser(request);if(!env.DB||!env.BUCKET)throw new HttpError(503,'素材存储尚未配置');
    const contentType=request.headers.get('content-type')??'';if(!contentType.startsWith('multipart/form-data'))throw new HttpError(400,'请上传图片文件');
    const length=Number(request.headers.get('content-length')??0);if(length>LIMIT+65536)throw new HttpError(413,'图片不得超过 8 MB');
    const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'请选择图片');const chunks:Uint8Array[]=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>LIMIT+65536){await reader.cancel();throw new HttpError(413,'图片不得超过 8 MB');}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const form=await new Response(bytes,{headers:{'Content-Type':contentType}}).formData();const file=form.get('file');
    if(!file||typeof file==='string'||file.size===0)throw new HttpError(400,'请选择图片');if(file.size>LIMIT)throw new HttpError(413,'图片不得超过 8 MB');
    const data=await file.arrayBuffer();const mime=sniff(new Uint8Array(data));if(!mime)throw new HttpError(400,'仅支持 PNG、JPEG 和 WebP 图片');
    const id=crypto.randomUUID();const name=file.name.replace(/[^\p{L}\p{N}_. -]/gu,'').slice(0,100)||'图片';const key=`${user.userId}/${id}`;
    await env.BUCKET.put(key,data,{httpMetadata:{contentType:mime}});
    try{await env.DB.prepare('INSERT INTO assets (user_id,id,name,mime_type,created_at) VALUES (?,?,?,?,?)').bind(user.userId,id,name,mime,new Date().toISOString()).run();}catch(e){await env.BUCKET.delete(key);throw e;}
    return json({id,name,url:`/api/assets/${id}`});
  }catch(e){return errorResponse(e);}
}
export async function GET(){try{const user=await requireUser();if(!env.DB)throw new HttpError(503,'素材存储尚未配置');const rows=await env.DB.prepare('SELECT id,name,mime_type AS mimeType,created_at AS createdAt FROM assets WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').bind(user.userId).all();return json({assets:rows.results.map(row=>({...row,url:`/api/assets/${row.id}`}))});}catch(e){return errorResponse(e);}}
