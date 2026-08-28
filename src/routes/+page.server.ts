import type { PageServerLoad } from './$types';
import { getLibraryStats, listLibraryItems } from '$lib/server/library';
import { requireUser } from '$lib/server/auth';
import {
	getTrending,
	getPopularMovies,
	getPopularTv,
	getUpcomingMovies,
	type TmdbSearchResultItem
} from '$lib/server/tmdb';

/**
 * Las secciones de descubrimiento (tendencias/populares/próximos) dependen de TMDB_API_KEY.
 * Si falla (key no configurada, TMDb caído, etc.), la sección simplemente no se muestra en vez
 * de romper el dashboard completo — la biblioteca del usuario sigue funcionando igual.
 */
async function safeTmdbList(fetcher: () => Promise<TmdbSearchResultItem[]>) {
	try {
		return await fetcher();
	} catch {
		return [];
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const [stats, recent, trending, popularMovies, popularTv, upcomingMovies] = await Promise.all([
		getLibraryStats(user.id),
		listLibraryItems(user.id).then((items) => items.slice(0, 10)),
		safeTmdbList(() => getTrending('week')),
		safeTmdbList(getPopularMovies),
		safeTmdbList(getPopularTv),
		safeTmdbList(getUpcomingMovies)
	]);

	return { stats, recent, trending, popularMovies, popularTv, upcomingMovies };
};
