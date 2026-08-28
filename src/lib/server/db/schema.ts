import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
	'users',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		email: text('email').notNull(),
		passwordHash: text('password_hash').notNull(),
		createdAt: text('created_at')
			.notNull()
			.$defaultFn(() => new Date().toISOString())
	},
	(table) => [uniqueIndex('users_email_unique').on(table.email)]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/** Sesión de login. `id` es sha256(token) en hex — el token en claro nunca se persiste. */
export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: text('expires_at').notNull()
});

export type Session = typeof sessions.$inferSelect;

export const libraryItems = sqliteTable(
	'library_items',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tmdbId: integer('tmdb_id').notNull(),
		mediaType: text('media_type', { enum: ['movie', 'tv'] }).notNull(),
		title: text('title').notNull(),
		posterPath: text('poster_path'),
		overview: text('overview'),
		releaseDate: text('release_date'),
		genres: text('genres', { mode: 'json' }).$type<string[]>().notNull().default([]),
		status: text('status', { enum: ['planned', 'completed'] }).notNull().default('planned'),
		rating: integer('rating'),
		notes: text('notes'),
		createdAt: text('created_at')
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		updatedAt: text('updated_at')
			.notNull()
			.$defaultFn(() => new Date().toISOString())
	},
	(table) => [index('library_items_user_id_idx').on(table.userId)]
);

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

/** Tokens OAuth de Trakt por usuario (uno por usuario, 1:1 con `users`). */
export const traktAccounts = sqliteTable('trakt_accounts', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	traktUsername: text('trakt_username'),
	accessToken: text('access_token').notNull(),
	refreshToken: text('refresh_token').notNull(),
	expiresAt: text('expires_at').notNull(),
	lastSyncedAt: text('last_synced_at'),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
});

export type TraktAccount = typeof traktAccounts.$inferSelect;
export type NewTraktAccount = typeof traktAccounts.$inferInsert;
