import { and, desc, eq } from 'drizzle-orm';
import { db } from './db';
import { libraryItems, type LibraryItem, type NewLibraryItem } from './db/schema';

/**
 * Capa de acceso a la tabla `library_items` mediante Drizzle ORM.
 * Toda la lógica de CRUD y estadísticas de la biblioteca del usuario vive aquí.
 */

export interface LibraryFilters {
	status?: LibraryItem['status'];
	mediaType?: LibraryItem['mediaType'];
}

/** Lista items de la biblioteca, opcionalmente filtrados por status y/o mediaType. */
export async function listLibraryItems(filters: LibraryFilters = {}): Promise<LibraryItem[]> {
	const conditions = [];
	if (filters.status) conditions.push(eq(libraryItems.status, filters.status));
	if (filters.mediaType) conditions.push(eq(libraryItems.mediaType, filters.mediaType));

	const query = db.select().from(libraryItems).orderBy(desc(libraryItems.updatedAt));

	if (conditions.length === 0) {
		return query;
	}

	return db
		.select()
		.from(libraryItems)
		.where(and(...conditions))
		.orderBy(desc(libraryItems.updatedAt));
}

/** Obtiene un item de la biblioteca por su id interno, o `undefined` si no existe. */
export async function getLibraryItem(id: number): Promise<LibraryItem | undefined> {
	const [item] = await db.select().from(libraryItems).where(eq(libraryItems.id, id));
	return item;
}

/** Busca un item de la biblioteca por su (tmdbId, mediaType), o `undefined` si no está guardado. */
export async function findLibraryItemByTmdb(
	tmdbId: number,
	mediaType: LibraryItem['mediaType']
): Promise<LibraryItem | undefined> {
	const [item] = await db
		.select()
		.from(libraryItems)
		.where(and(eq(libraryItems.tmdbId, tmdbId), eq(libraryItems.mediaType, mediaType)));
	return item;
}

/** Agrega un nuevo item a la biblioteca. */
export async function addToLibrary(item: NewLibraryItem): Promise<LibraryItem> {
	const [inserted] = await db.insert(libraryItems).values(item).returning();
	return inserted;
}

/** Campos editables de un item existente (no se puede cambiar id, createdAt ni updatedAt a mano). */
export type LibraryItemPatch = Partial<Omit<NewLibraryItem, 'id' | 'createdAt' | 'updatedAt'>>;

/** Actualiza un item existente y refresca `updatedAt`. Devuelve `undefined` si no existe. */
export async function updateLibraryItem(
	id: number,
	patch: LibraryItemPatch
): Promise<LibraryItem | undefined> {
	const [updated] = await db
		.update(libraryItems)
		.set({ ...patch, updatedAt: new Date().toISOString() })
		.where(eq(libraryItems.id, id))
		.returning();
	return updated;
}

/** Elimina un item de la biblioteca. Devuelve `true` si existía y fue eliminado. */
export async function removeFromLibrary(id: number): Promise<boolean> {
	const deleted = await db
		.delete(libraryItems)
		.where(eq(libraryItems.id, id))
		.returning({ id: libraryItems.id });
	return deleted.length > 0;
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
 * Calcula estadísticas agregadas de toda la biblioteca: total, distribución por status,
 * distribución por mediaType, top géneros y promedio de rating (solo sobre items con rating
 * no nulo).
 */
export async function getLibraryStats(): Promise<LibraryStats> {
	const items = await db.select().from(libraryItems);

	const byStatus: Record<LibraryItem['status'], number> = {
		planned: 0,
		watching: 0,
		completed: 0,
		dropped: 0
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
