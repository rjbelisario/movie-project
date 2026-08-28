import type { PageServerLoad } from './$types';
import { getLibraryStats } from '$lib/server/library';

export const load: PageServerLoad = async () => {
	return { stats: await getLibraryStats() };
};
