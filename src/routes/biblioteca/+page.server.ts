import type { PageServerLoad } from './$types';
import { listLibraryItems } from '$lib/server/library';
import { requireUser } from '$lib/server/auth';
import type { LibraryItem } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals);
	const status = url.searchParams.get('status') as LibraryItem['status'] | null;
	const mediaType = url.searchParams.get('mediaType') as LibraryItem['mediaType'] | null;

	const items = await listLibraryItems(user.id, {
		status: status ?? undefined,
		mediaType: mediaType ?? undefined
	});

	return { items, status, mediaType };
};
