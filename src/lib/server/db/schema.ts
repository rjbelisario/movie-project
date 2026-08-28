import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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

/**
 * Progreso por episodio de una serie. La presencia de una fila = episodio visto; no hay
 * columna booleana porque no tiene sentido guardar un episodio "no visto" explícitamente.
 */
export const episodeProgress = sqliteTable(
	'episode_progress',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		libraryItemId: integer('library_item_id')
			.notNull()
			.references(() => libraryItems.id, { onDelete: 'cascade' }),
		seasonNumber: integer('season_number').notNull(),
		episodeNumber: integer('episode_number').notNull(),
		watchedAt: text('watched_at')
			.notNull()
			.$defaultFn(() => new Date().toISOString())
	},
	(table) => [
		uniqueIndex('episode_progress_unique').on(
			table.libraryItemId,
			table.seasonNumber,
			table.episodeNumber
		)
	]
);

export type EpisodeProgress = typeof episodeProgress.$inferSelect;
