import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {LIST_PROJECTS,FIND_PROJECT,UPSERT_PROJECT,DELETE_PROJECT,FIND_OWNED_ASSET} from '../lib/server/project-queries.ts';
function database(){const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../drizzle/0000_goofy_maximus.sql',import.meta.url),'utf8'));return db;}
function save(db,user,title,time){return db.prepare(UPSERT_PROJECT).run(user,'shared-id',title,JSON.stringify({title}),'2026-01-01T00:00:00.000Z',time);}
test('older and equal timestamp requests cannot overwrite a later saved project',()=>{
  const db=database();
  save(db,'alice','latest','2026-01-01T00:00:02.000Z');
  assert.equal(save(db,'alice','stale','2026-01-01T00:00:01.000Z').changes,0);
  assert.equal(save(db,'alice','equal but different','2026-01-01T00:00:02.000Z').changes,0);
  assert.equal(JSON.parse(db.prepare(FIND_PROJECT).get('alice','shared-id').film).title,'latest');
  assert.equal(save(db,'alice','next','2026-01-01T00:00:03.000Z').changes,1);
  assert.equal(JSON.parse(db.prepare(FIND_PROJECT).get('alice','shared-id').film).title,'next');db.close();
});
test('same project id is isolated by authenticated owner for read, write and delete',()=>{
  const db=database();save(db,'alice','Alice film','2026-01-01T00:00:00.000Z');save(db,'bob','Bob film','2026-01-01T00:00:01.000Z');
  assert.equal(db.prepare(LIST_PROJECTS).all('alice').length,1);
  assert.equal(JSON.parse(db.prepare(FIND_PROJECT).get('alice','shared-id').film).title,'Alice film');
  assert.equal(db.prepare(DELETE_PROJECT).run('mallory','shared-id').changes,0);
  assert.equal(db.prepare(DELETE_PROJECT).run('bob','shared-id').changes,1);
  assert.ok(db.prepare(FIND_PROJECT).get('alice','shared-id'));db.close();
});
test('asset reference checks reject another owner even when the id is known',()=>{
  const db=database();db.prepare('INSERT INTO assets VALUES (?,?,?,?,?)').run('alice','asset-123','image.png','image/png','2026-01-01T00:00:00.000Z');
  assert.ok(db.prepare(FIND_OWNED_ASSET).get('alice','asset-123'));
  assert.equal(db.prepare(FIND_OWNED_ASSET).get('bob','asset-123'),undefined);db.close();
});
