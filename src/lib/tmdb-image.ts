const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

/** Tamaños de imagen soportados por el servicio de imágenes de TMDb para pósters. */
export type TmdbPosterSize =
	| 'w92'
	| 'w154'
	| 'w185'
	| 'w342'
	| 'w500'
	| 'w780'
	| 'w1280'
	| 'original';

/**
 * Construye la URL completa de un póster de TMDb. Vive fuera de `$lib/server` porque también
 * se usa desde componentes que corren en el cliente (SvelteKit prohíbe importar módulos de
 * `$lib/server` en código alcanzable por el navegador).
 */
export function posterUrl(path: string | null, size: TmdbPosterSize = 'w342'): string | null {
	if (!path) return null;
	return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}
