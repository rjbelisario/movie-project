import type { PageServerLoad } from './$types';
import { getGenres } from '$lib/server/tmdb';
import type { TmdbGenre } from '$lib/server/tmdb';

export const load: PageServerLoad = async () => {
	const [movieGenres, tvGenres] = await Promise.all([
		getGenres('movie').catch((): TmdbGenre[] => []),
		getGenres('tv').catch((): TmdbGenre[] => [])
	]);
	return { movieGenres, tvGenres };
};
