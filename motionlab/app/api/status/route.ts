import { env } from 'cloudflare:workers';
import { json,requireUser,errorResponse } from '../../../lib/server/http';
export async function GET() {
  try {await requireUser();return json({modelConfigured:!!(env.MODEL_API_KEY&&env.MODEL_BASE_URL&&env.MODEL_NAME),mode:env.MODEL_API_KEY&&env.MODEL_BASE_URL&&env.MODEL_NAME?'model':'template',model:env.MODEL_NAME??null,storage:env.DB?'cloud':'unavailable',uploads:!!env.BUCKET});}catch(e){return errorResponse(e);}
}
