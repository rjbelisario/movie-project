import { and, desc, eq, inArray } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from './db';
import {
	libraryItems,
	episodeProgress,
	type LibraryItem,
	type NewLibraryItem,
	type EpisodeProgress
} from './db/schema';

/**
 * Capa de acceso a la tabla `library_items` mediante Drizzle ORM.
 * Toda la lógica de CRUD y estadísticas de la biblioteca del usuario vive aquí.
 * Cada función recibe `userId` y lo aplica en el WHERE de la propia query (no como
 * chequeo posterior a un fetch por id) para que un usuario nunca pueda leer ni mutar
 * datos de otro adivinando un id.
 */

export interface LibraryFilters {
	status?: LibraryItem['status'];
	mediaType?: LibraryItem['mediaType'];
}

/** Lista items de la biblioteca de `userId`, opcionalmente filtrados por status y/o mediaType. */
export async function listLibraryItems(
	userId: string,
	filters: LibraryFilters = {}
): Promise<LibraryItem[]> {
	const conditions = [eq(libraryItems.userId, userId)];
	if (filters.status) conditions.push(eq(libraryItems.status, filters.status));
	if (filters.mediaType) conditions.push(eq(libraryItems.mediaType, filters.mediaType));

	return db
		.select()
		.from(libraryItems)
		.where(and(...conditions))
		.orderBy(desc(libraryItems.updatedAt));
}

/** Obtiene un item de la biblioteca de `userId` por su id interno, o `undefined` si no existe. */
export async function getLibraryItem(userId: string, id: number): Promise<LibraryItem | undefined> {
	const [item] = await db
		.select()
		.from(libraryItems)
		.where(and(eq(libraryItems.id, id), eq(libraryItems.userId, userId)));
	return item;
}

/** Busca un item de la biblioteca de `userId` por su (tmdbId, mediaType), o `undefined`. */
export async function findLibraryItemByTmdb(
	userId: string,
	tmdbId: number,
	mediaType: LibraryItem['mediaType']
): Promise<LibraryItem | undefined> {
	const [item] = await db
		.select()
		.from(libraryItems)
		.where(
			and(
				eq(libraryItems.userId, userId),
				eq(libraryItems.tmdbId, tmdbId),
				eq(libraryItems.mediaType, mediaType)
			)
		);
	return item;
}

/** Agrega un nuevo item a la biblioteca de `userId`. */
export async function addToLibrary(
	userId: string,
	item: Omit<NewLibraryItem, 'userId'>
): Promise<LibraryItem> {
	const [inserted] = await db
		.insert(libraryItems)
		.values({ ...item, userId })
		.returning();
	return inserted;
}

/** Campos editables de un item existente (no se puede cambiar id, userId, createdAt ni updatedAt a mano). */
export type LibraryItemPatch = Partial<Omit<NewLibraryItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>;

/** Actualiza un item existente de `userId` y refresca `updatedAt`. Devuelve `undefined` si no existe o no es suyo. */
export async function updateLibraryItem(
	userId: string,
	id: number,
	patch: LibraryItemPatch
): Promise<LibraryItem | undefined> {
	const [updated] = await db
		.update(libraryItems)
		.set({ ...patch, updatedAt: new Date().toISOString() })
		.where(and(eq(libraryItems.id, id), eq(libraryItems.userId, userId)))
		.returning();
	return updated;
}

/** Elimina un item de la biblioteca de `userId`. Devuelve `true` si existía y era suyo. */
export async function removeFromLibrary(userId: string, id: number): Promise<boolean> {
	const deleted = await db
		.delete(libraryItems)
		.where(and(eq(libraryItems.id, id), eq(libraryItems.userId, userId)))
		.returning({ id: libraryItems.id });
	return deleted.length > 0;
}

/** Episodios vistos de una serie de la biblioteca de `userId`, como pares (temporada, episodio). */
export async function getWatchedEpisodes(
	userId: string,
	libraryItemId: number
): Promise<Pick<EpisodeProgress, 'seasonNumber' | 'episodeNumber'>[]> {
	return db
		.select({
			seasonNumber: episodeProgress.seasonNumber,
			episodeNumber: episodeProgress.episodeNumber
		})
		.from(episodeProgress)
		.innerJoin(libraryItems, eq(episodeProgress.libraryItemId, libraryItems.id))
		.where(and(eq(episodeProgress.libraryItemId, libraryItemId), eq(libraryItems.userId, userId)));
}

/** Número total de episodios vistos de una serie de la biblioteca de `userId`. */
export async function countWatchedEpisodes(userId: string, libraryItemId: number): Promise<number> {
	const rows = await getWatchedEpisodes(userId, libraryItemId);
	return rows.length;
}

/**
 * Marca un episodio como visto. Idempotente: si ya estaba marcado, no hace nada.
 * Verifica propiedad del library_item dentro de una transacción antes de insertar,
 * para no crear progreso de episodios sobre un item que no es de `userId`.
 */
export async function markEpisodeWatched(
	userId: string,
	libraryItemId: number,
	seasonNumber: number,
	episodeNumber: number
): Promise<void> {
	await db.transaction(async (tx) => {
		const [owned] = await tx
			.select({ id: libraryItems.id })
			.from(libraryItems)
			.where(and(eq(libraryItems.id, libraryItemId), eq(libraryItems.userId, userId)));

		if (!owned) error(404, 'Item no encontrado en la biblioteca.');

		await tx
			.insert(episodeProgress)
			.values({ libraryItemId, seasonNumber, episodeNumber })
			.onConflictDoNothing();
	});
}

/** Quita la marca de visto de un episodio de la biblioteca de `userId`. Idempotente. */
export async function markEpisodeUnwatched(
	userId: string,
	libraryItemId: number,
	seasonNumber: number,
	episodeNumber: number
): Promise<void> {
	await db.delete(episodeProgress).where(
		and(
			eq(episodeProgress.libraryItemId, libraryItemId),
			eq(episodeProgress.seasonNumber, seasonNumber),
			eq(episodeProgress.episodeNumber, episodeNumber),
			inArray(
				episodeProgress.libraryItemId,
				db.select({ id: libraryItems.id }).from(libraryItems).where(eq(libraryItems.userId, userId))
			)
		)
	);
}

export interface LibraryGenreCount {
	genre: string;
	count: number;
}

export interface LibraryStats {
	total: number;
	byStatus: Record<LibraryItem['status'], number>;
	byMediaType: Record<LibraryItem['mediaType'], number>;
	topGenres: LibraryGenreCount[];
	averageRating: number | null;
}

/**
 * Calcula estadísticas agregadas de la biblioteca de `userId`: total, distribución por status,
 * distribución por mediaType, top géneros y promedio de rating (solo sobre items con rating
 * no nulo).
 */
export async function getLibraryStats(userId: string): Promise<LibraryStats> {
	const items = await db.select().from(libraryItems).where(eq(libraryItems.userId, userId));

	const byStatus: Record<LibraryItem['status'], number> = {
		planned: 0,
		completed: 0
	};
	const byMediaType: Record<LibraryItem['mediaType'], number> = {
		movie: 0,
		tv: 0
	};
	const genreCounts = new Map<string, number>();
	let ratingSum = 0;
	let ratingCount = 0;

	for (const item of items) {
		byStatus[item.status]++;
		byMediaType[item.mediaType]++;

		for (const genre of item.genres) {
			genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
		}

		if (item.rating !== null) {
			ratingSum += item.rating;
			ratingCount++;
		}
	}

	const topGenres = [...genreCounts.entries()]
		.map(([genre, count]) => ({ genre, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 10);

	return {
		total: items.length,
		byStatus,
		byMediaType,
		topGenres,
		averageRating: ratingCount > 0 ? ratingSum / ratingCount : null
	};
}
