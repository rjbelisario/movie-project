import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getMediaDetails, getCredits, getTrailerKey, getSimilar, getGenres } from '$lib/server/tmdb';
import { findLibraryItemByTmdb, getWatchedEpisodes } from '$lib/server/library';
import type { TmdbMediaType, TmdbCredits, TmdbSearchResultItem, TmdbGenre } from '$lib/server/tmdb';

function parseMediaType(param: string): TmdbMediaType {
	if (param !== 'movie' && param !== 'tv') {
		error(400, `Tipo de contenido inválido: ${param}`);
	}
	return param;
}

export const load: PageServerLoad = async ({ params }) => {
	const mediaType = parseMediaType(params.mediaType);
	const tmdbId = Number(params.id);
	if (!Number.isInteger(tmdbId)) {
		error(400, `id inválido: ${params.id}`);
	}

	let details;
	try {
		details = await getMediaDetails(mediaType, tmdbId);
	} catch {
		error(404, 'No se encontró ese título en TMDb.');
	}

	const [libraryItem, credits, trailerKey, similar, genreList] = await Promise.all([
		findLibraryItemByTmdb(tmdbId, mediaType),
		getCredits(mediaType, tmdbId).catch((): TmdbCredits => ({ cast: [], directors: [] })),
		getTrailerKey(mediaType, tmdbId).catch((): null => null),
		getSimilar(mediaType, tmdbId).catch((): TmdbSearchResultItem[] => []),
		getGenres(mediaType).catch((): TmdbGenre[] => [])
	]);

	const genreNameToId = new Map(genreList.map((genre) => [genre.name, genre.id]));
	const genres = details.genres.map((name) => ({ name, id: genreNameToId.get(name) ?? null }));

	const watchedEpisodes =
		mediaType === 'tv' && libraryItem ? await getWatchedEpisodes(libraryItem.id) : [];

	return { details, genres, libraryItem, watchedEpisodes, credits, trailerKey, similar };
};
