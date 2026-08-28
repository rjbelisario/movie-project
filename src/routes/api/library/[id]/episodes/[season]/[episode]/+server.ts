import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { markEpisodeWatched, markEpisodeUnwatched } from '$lib/server/library';
import { requireUser } from '$lib/server/auth';

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
export const PUT: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);
	const { libraryItemId, seasonNumber, episodeNumber } = parseParams(params);

	await markEpisodeWatched(user.id, libraryItemId, seasonNumber, episodeNumber);
	return json({ watched: true });
};

/** Quita la marca de visto de un episodio. */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);
	const { libraryItemId, seasonNumber, episodeNumber } = parseParams(params);

	await markEpisodeUnwatched(user.id, libraryItemId, seasonNumber, episodeNumber);
	return json({ watched: false });
};
