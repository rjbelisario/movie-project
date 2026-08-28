import { getGenres } from '$lib/server/tmdb';
import { TtlCache } from './cache';
import type { GenreDirectory } from './types';

const GENRE_DIRECTORY_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new TtlCache<GenreDirectory>(GENRE_DIRECTORY_TTL_MS);
const CACHE_KEY = 'genre-directory';

/**
 * Mapa nombre↔id de género de TMDb, combinando movie y tv. Los ids compartidos entre ambos
 * (ej. Drama, Comedia) tienen el mismo nombre en las dos listas, así que combinarlos en un
 * único mapa es seguro. Necesario porque `library_items.genres` guarda nombres, mientras que
 * los candidatos de endpoints de lista traen `genreIds` (números).
 */
export async function getGenreDirectory(): Promise<GenreDirectory> {
	return cache.getOrCompute(CACHE_KEY, async () => {
		const [movieGenres, tvGenres] = await Promise.all([
			getGenres('movie').catch(() => []),
			getGenres('tv').catch(() => [])
		]);

		const nameToId = new Map<string, number>();
		const idToName = new Map<number, string>();
		for (const genre of [...movieGenres, ...tvGenres]) {
			nameToId.set(genre.name, genre.id);
			idToName.set(genre.id, genre.name);
		}
		return { nameToId, idToName };
	});
}
