import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLibraryStats } from '$lib/server/library';

export const GET: RequestHandler = async () => {
	const stats = await getLibraryStats();
	return json(stats);
};
