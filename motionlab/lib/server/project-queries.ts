/** Every project query is partitioned by the authenticated user. */
export const LIST_PROJECTS = 'SELECT film FROM projects WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200';
export const FIND_PROJECT = 'SELECT film FROM projects WHERE user_id = ? AND id = ?';
export const UPSERT_PROJECT = 'INSERT INTO projects (user_id,id,title,film,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET title=excluded.title,film=excluded.film,updated_at=excluded.updated_at WHERE excluded.updated_at > projects.updated_at';
export const DELETE_PROJECT = 'DELETE FROM projects WHERE user_id = ? AND id = ?';
export const FIND_OWNED_ASSET = 'SELECT id FROM assets WHERE user_id = ? AND id = ?';
