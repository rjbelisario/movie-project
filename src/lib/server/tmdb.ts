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
	tagline: string;
	overview: string;
	posterPath: string | null;
	backdropPath: string | null;
	releaseDate: string | null;
	genres: string[];
	voteAverage: number;
	status: string;
	/** Duración en minutos (solo películas). */
	runtimeMinutes: number | null;
	/** Número de temporadas (solo series). */
	numberOfSeasons: number | null;
	/** Número de episodios (solo series). */
	numberOfEpisodes: number | null;
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

interface TmdbRawResultsResponse {
	page: number;
	results: TmdbRawSearchResult[];
	total_pages: number;
	total_results: number;
}

interface TmdbRawMovieDetails {
	id: number;
	title: string;
	tagline: string | null;
	overview: string;
	poster_path: string | null;
	backdrop_path: string | null;
	release_date: string | null;
	genres: TmdbRawGenre[];
	vote_average: number;
	status: string;
	runtime: number | null;
}

interface TmdbRawTvDetails {
	id: number;
	name: string;
	tagline: string | null;
	overview: string;
	poster_path: string | null;
	backdrop_path: string | null;
	first_air_date: string | null;
	genres: TmdbRawGenre[];
	vote_average: number;
	status: string;
	number_of_seasons: number | null;
	number_of_episodes: number | null;
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

/**
 * Normaliza un resultado crudo de TMDb a `TmdbSearchResultItem`.
 * `forcedMediaType` se usa para endpoints como `/movie/popular` o `/tv/on_the_air`, que no
 * incluyen `media_type` en cada resultado porque ya está implícito en el endpoint. Sin ese
 * override (p. ej. en `/search/multi` o `/trending/all/*`), se descartan resultados que no sean
 * película o serie (como `person`).
 */
function mapSearchResult(
	raw: TmdbRawSearchResult,
	forcedMediaType?: TmdbMediaType
): TmdbSearchResultItem | null {
	const mediaType = forcedMediaType ?? raw.media_type;
	if (mediaType !== 'movie' && mediaType !== 'tv') {
		return null;
	}

	const title = mediaType === 'movie' ? raw.title : raw.name;
	const releaseDate = mediaType === 'movie' ? raw.release_date : raw.first_air_date;

	return {
		tmdbId: raw.id,
		mediaType,
		title: title ?? '',
		overview: raw.overview ?? '',
		posterPath: raw.poster_path ?? null,
		releaseDate: releaseDate ?? null
	};
}

async function fetchResultsList(
	path: string,
	forcedMediaType?: TmdbMediaType
): Promise<TmdbSearchResultItem[]> {
	const data = await tmdbFetch<TmdbRawResultsResponse>(path);
	return data.results
		.map((raw) => mapSearchResult(raw, forcedMediaType))
		.filter((item): item is TmdbSearchResultItem => item !== null);
}

/**
 * Búsqueda combinada de películas y series (endpoint `/search/multi`).
 * Filtra los resultados de tipo 'person', que TMDb también incluye en este endpoint.
 */
export async function searchMulti(query: string): Promise<TmdbSearchResultItem[]> {
	const trimmedQuery = query.trim();
	if (!trimmedQuery) return [];

	const data = await tmdbFetch<TmdbRawResultsResponse>('/search/multi', {
		query: trimmedQuery,
		include_adult: 'false'
	});

	return data.results
		.map((raw) => mapSearchResult(raw))
		.filter((item): item is TmdbSearchResultItem => item !== null);
}

/** Tendencias de la semana o del día, mezclando películas y series (`/trending/all/{window}`). */
export async function getTrending(window: 'day' | 'week' = 'week'): Promise<TmdbSearchResultItem[]> {
	return fetchResultsList(`/trending/all/${window}`);
}

/** Películas populares actualmente (`/movie/popular`). */
export async function getPopularMovies(): Promise<TmdbSearchResultItem[]> {
	return fetchResultsList('/movie/popular', 'movie');
}

/** Series populares actualmente (`/tv/popular`). */
export async function getPopularTv(): Promise<TmdbSearchResultItem[]> {
	return fetchResultsList('/tv/popular', 'tv');
}

/** Próximos estrenos de películas en cines (`/movie/upcoming`). */
export async function getUpcomingMovies(): Promise<TmdbSearchResultItem[]> {
	return fetchResultsList('/movie/upcoming', 'movie');
}

/** Series actualmente en emisión (`/tv/on_the_air`). */
export async function getOnTheAirTv(): Promise<TmdbSearchResultItem[]> {
	return fetchResultsList('/tv/on_the_air', 'tv');
}

/** Detalle completo de una película por su id de TMDb (endpoint `/movie/{id}`). */
export async function getMovieDetails(id: number): Promise<TmdbMediaDetails> {
	const data = await tmdbFetch<TmdbRawMovieDetails>(`/movie/${id}`);

	return {
		tmdbId: data.id,
		mediaType: 'movie',
		title: data.title,
		tagline: data.tagline ?? '',
		overview: data.overview,
		posterPath: data.poster_path,
		backdropPath: data.backdrop_path,
		releaseDate: data.release_date,
		genres: data.genres.map((genre) => genre.name),
		voteAverage: data.vote_average,
		status: data.status,
		runtimeMinutes: data.runtime,
		numberOfSeasons: null,
		numberOfEpisodes: null
	};
}

/** Detalle completo de una serie por su id de TMDb (endpoint `/tv/{id}`). */
export async function getTvDetails(id: number): Promise<TmdbMediaDetails> {
	const data = await tmdbFetch<TmdbRawTvDetails>(`/tv/${id}`);

	return {
		tmdbId: data.id,
		mediaType: 'tv',
		title: data.name,
		tagline: data.tagline ?? '',
		overview: data.overview,
		posterPath: data.poster_path,
		backdropPath: data.backdrop_path,
		releaseDate: data.first_air_date,
		genres: data.genres.map((genre) => genre.name),
		voteAverage: data.vote_average,
		status: data.status,
		runtimeMinutes: null,
		numberOfSeasons: data.number_of_seasons,
		numberOfEpisodes: data.number_of_episodes
	};
}

/** Detalle completo de una película o serie, según `mediaType` (conveniencia sobre las dos funciones anteriores). */
export async function getMediaDetails(
	mediaType: TmdbMediaType,
	id: number
): Promise<TmdbMediaDetails> {
	return mediaType === 'movie' ? getMovieDetails(id) : getTvDetails(id);
}
