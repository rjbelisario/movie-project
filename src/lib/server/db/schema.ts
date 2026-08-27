import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const libraryItems = sqliteTable('library_items', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	tmdbId: integer('tmdb_id').notNull(),
	mediaType: text('media_type', { enum: ['movie', 'tv'] }).notNull(),
	title: text('title').notNull(),
	posterPath: text('poster_path'),
	overview: text('overview'),
	releaseDate: text('release_date'),
	genres: text('genres', { mode: 'json' }).$type<string[]>().notNull().default([]),
	status: text('status', { enum: ['planned', 'watching', 'completed', 'dropped'] })
		.notNull()
		.default('planned'),
	rating: integer('rating'),
	notes: text('notes'),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
});

export type LibraryItem = typeof libraryItems.$inferSelect;
export type NewLibraryItem = typeof libraryItems.$inferInsert;
