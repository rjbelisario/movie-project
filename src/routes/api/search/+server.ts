import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchMulti } from '$lib/server/tmdb';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q') ?? '';
	const results = await searchMulti(query);
	return json(results);
};
