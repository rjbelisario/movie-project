import type { LibraryItem } from '$lib/server/db/schema';

/**
 * Forma común que consumen los componentes de tarjetas: un resultado de búsqueda de TMDb
 * (sin `id`/`status`/`rating`/`notes`, porque todavía no está en la biblioteca) o un
 * `LibraryItem` completo ya guardado en SQLite.
 */
export type CardItem = Partial<
	Pick<LibraryItem, 'id' | 'status' | 'rating' | 'notes' | 'genres'>
> &
	Pick<LibraryItem, 'tmdbId' | 'mediaType' | 'title' | 'posterPath'> &
	Partial<Pick<LibraryItem, 'overview' | 'releaseDate'>>;
