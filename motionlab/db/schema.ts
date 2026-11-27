import { sqliteTable, text, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const projects = sqliteTable('projects', {
  userId: text('user_id').notNull(),
  id: text('id').notNull(),
  title: text('title').notNull(),
  film: text('film').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [primaryKey({columns:[table.userId,table.id]}),index('projects_user_updated_idx').on(table.userId,table.updatedAt)]);
export const assets = sqliteTable('assets', {
  userId: text('user_id').notNull(),
  id: text('id').notNull(),
  name: text('name').notNull(),
  mimeType: text('mime_type').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [primaryKey({columns:[table.userId,table.id]})]);
