import { env } from '$env/dynamic/private';
import { posterUrl, type TmdbPosterSize } from '$lib/tmdb-image';

export { posterUrl, type TmdbPosterSize };

/**
 * Cliente server-side de la API de TMDb v3 (https://api.themoviedb.org/3).
 *
 * IMPORTANTE: este módulo nunca debe importarse desde código que se ejecute en el cliente.
 * Solo debe usarse desde `+server.ts` o `+page.server.ts`, ya que las funciones exportadas
 * adjuntan la API key en cada solicitud.
 */

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export type TmdbMediaType = 'movie' | 'tv';

export interface TmdbSearchResultItem {
	tmdbId: number;
	mediaType: TmdbMediaType;
	title: string;
	overview: string;
	posterPath: string | null;
	releaseDate: string | null;
}

export interface TmdbMediaDetails {
	tmdbId: number;
	mediaType: TmdbMediaType;
	title: string;
	overview: string;
	posterPath: string | null;
	releaseDate: string | null;
	genres: string[];
}

// --- Formas crudas de las respuestas de la API de TMDb (solo los campos que usamos) ---

interface TmdbRawGenre {
	id: number;
	name: string;
}

interface TmdbRawSearchResult {
	id: number;
	media_type?: 'movie' | 'tv' | 'person';
	title?: string;
	name?: string;
	overview?: string;
	poster_path?: string | null;
	release_date?: string;
	first_air_date?: string;
}

interface TmdbRawSearchMultiResponse {
	page: number;
	results: TmdbRawSearchResult[];
	total_pages: number;
	total_results: number;
}

interface TmdbRawMovieDetails {
	id: number;
	title: string;
	overview: string;
	poster_path: string | null;
	release_date: string | null;
	genres: TmdbRawGenre[];
}

interface TmdbRawTvDetails {
	id: number;
	name: string;
	overview: string;
	poster_path: string | null;
	first_air_date: string | null;
	genres: TmdbRawGenre[];
}

/**
 * Devuelve la API key de TMDb configurada, o lanza un error claro si falta.
 * Se llama de forma perezosa (solo al invocar una función de este módulo), nunca al importarlo,
 * para no romper el arranque de la app cuando aún no se configuró TMDB_API_KEY.
 */
function getApiKey(): string {
	const apiKey = env.TMDB_API_KEY;
	if (!apiKey) {
		throw new Error(
			'TMDB_API_KEY no está configurada. Define la variable de entorno TMDB_API_KEY en tu archivo .env con una API key válida de https://www.themoviedb.org/settings/api.'
		);
	}
	return apiKey;
}

async function tmdbFetch<T>(path: string, searchParams: Record<string, string> = {}): Promise<T> {
	const apiKey = getApiKey();
	const url = new URL(`${TMDB_BASE_URL}${path}`);
	url.searchParams.set('api_key', apiKey);
	url.searchParams.set('language', 'es-ES');
	for (const [key, value] of Object.entries(searchParams)) {
		url.searchParams.set(key, value);
	}

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Error de TMDb (${response.status} ${response.statusText}) al solicitar ${path}.`
		);
	}

	return (await response.json()) as T;
}

function mapSearchResult(raw: TmdbRawSearchResult): TmdbSearchResultItem | null {
	if (raw.media_type !== 'movie' && raw.media_type !== 'tv') {
		// Ignoramos resultados que no sean película o serie (p. ej. 'person').
		return null;
	}

	const title = raw.media_type === 'movie' ? raw.title : raw.name;
	const releaseDate = raw.media_type === 'movie' ? raw.release_date : raw.first_air_date;

	return {
		tmdbId: raw.id,
		mediaType: raw.media_type,
		title: title ?? '',
		overview: raw.overview ?? '',
		posterPath: raw.poster_path ?? null,
		releaseDate: releaseDate ?? null
	};
}

/**
 * Búsqueda combinada de películas y series (endpoint `/search/multi`).
 * Filtra los resultados de tipo 'person', que TMDb también incluye en este endpoint.
 */
export async function searchMulti(query: string): Promise<TmdbSearchResultItem[]> {
	const trimmedQuery = query.trim();
	if (!trimmedQuery) return [];

	const data = await tmdbFetch<TmdbRawSearchMultiResponse>('/search/multi', {
		query: trimmedQuery,
		include_adult: 'false'
	});

	return data.results
		.map(mapSearchResult)
		.filter((item): item is TmdbSearchResultItem => item !== null);
}

/** Detalle completo de una película por su id de TMDb (endpoint `/movie/{id}`). */
export async function getMovieDetails(id: number): Promise<TmdbMediaDetails> {
	const data = await tmdbFetch<TmdbRawMovieDetails>(`/movie/${id}`);

	return {
		tmdbId: data.id,
		mediaType: 'movie',
		title: data.title,
		overview: data.overview,
		posterPath: data.poster_path,
		releaseDate: data.release_date,
		genres: data.genres.map((genre) => genre.name)
	};
}

/** Detalle completo de una serie por su id de TMDb (endpoint `/tv/{id}`). */
export async function getTvDetails(id: number): Promise<TmdbMediaDetails> {
	const data = await tmdbFetch<TmdbRawTvDetails>(`/tv/${id}`);

	return {
		tmdbId: data.id,
		mediaType: 'tv',
		title: data.name,
		overview: data.overview,
		posterPath: data.poster_path,
		releaseDate: data.first_air_date,
		genres: data.genres.map((genre) => genre.name)
	};
}
