import type { PageServerLoad } from './$types';
import { getLibraryStats, listLibraryItems } from '$lib/server/library';

export const load: PageServerLoad = async () => {
	const [stats, recent] = await Promise.all([
		getLibraryStats(),
		listLibraryItems().then((items) => items.slice(0, 5))
	]);

	return { stats, recent };
};
