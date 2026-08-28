import type { PageServerLoad } from './$types';
import { getLibraryStats } from '$lib/server/library';
import { requireUser } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	return { stats: await getLibraryStats(user.id) };
};
