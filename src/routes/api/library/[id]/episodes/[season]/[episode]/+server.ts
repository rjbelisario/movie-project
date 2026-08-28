import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLibraryItem, markEpisodeWatched, markEpisodeUnwatched } from '$lib/server/library';

function parseParams(params: { id: string; season: string; episode: string }) {
	const libraryItemId = Number(params.id);
	const seasonNumber = Number(params.season);
	const episodeNumber = Number(params.episode);
	if (
		!Number.isInteger(libraryItemId) ||
		!Number.isInteger(seasonNumber) ||
		!Number.isInteger(episodeNumber)
	) {
		error(400, 'Parámetros inválidos.');
	}
	return { libraryItemId, seasonNumber, episodeNumber };
}

/** Marca un episodio como visto. */
export const PUT: RequestHandler = async ({ params }) => {
	const { libraryItemId, seasonNumber, episodeNumber } = parseParams(params);

	if (!(await getLibraryItem(libraryItemId))) {
		error(404, 'Item no encontrado en la biblioteca.');
	}

	await markEpisodeWatched(libraryItemId, seasonNumber, episodeNumber);
	return json({ watched: true });
};

/** Quita la marca de visto de un episodio. */
export const DELETE: RequestHandler = async ({ params }) => {
	const { libraryItemId, seasonNumber, episodeNumber } = parseParams(params);

	if (!(await getLibraryItem(libraryItemId))) {
		error(404, 'Item no encontrado en la biblioteca.');
	}

	await markEpisodeUnwatched(libraryItemId, seasonNumber, episodeNumber);
	return json({ watched: false });
};
