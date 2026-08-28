import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLibraryStats } from '$lib/server/library';
import { requireUser } from '$lib/server/auth';

export const GET: RequestHandler = async ({ locals }) => {
	const user = requireUser(locals);
	const stats = await getLibraryStats(user.id);
	return json(stats);
};
