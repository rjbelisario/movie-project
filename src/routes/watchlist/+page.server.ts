import type { PageServerLoad } from './$types';
import { listLibraryItems } from '$lib/server/library';

export const load: PageServerLoad = async () => {
	const items = await listLibraryItems({ status: 'planned' });
	return { items };
};
