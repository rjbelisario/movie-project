import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSeasonDetails } from '$lib/server/tmdb';

export const GET: RequestHandler = async ({ params }) => {
	const tvId = Number(params.id);
	const seasonNumber = Number(params.season);
	if (!Number.isInteger(tvId) || !Number.isInteger(seasonNumber)) {
		error(400, 'id o número de temporada inválido.');
	}

	const season = await getSeasonDetails(tvId, seasonNumber);
	return json(season);
};
