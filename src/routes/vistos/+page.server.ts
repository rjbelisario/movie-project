import type { PageServerLoad } from './$types';
import { listLibraryItems } from '$lib/server/library';
import { requireUser } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const items = await listLibraryItems(user.id, { status: 'completed' });
	return { items };
};
