import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { discoverByGenre } from '$lib/server/tmdb';
import type { TmdbMediaType } from '$lib/server/tmdb';

export const GET: RequestHandler = async ({ url }) => {
	const genreId = Number(url.searchParams.get('genre'));
	const mediaType = url.searchParams.get('mediaType');

	if (!Number.isInteger(genreId)) {
		error(400, 'genre inválido.');
	}
	if (mediaType !== 'movie' && mediaType !== 'tv') {
		error(400, `mediaType inválido: ${mediaType}`);
	}

	const results = await discoverByGenre(mediaType as TmdbMediaType, genreId);
	return json(results);
};
