import type { PageServerLoad } from './$types';
import { listLibraryItems } from '$lib/server/library';
import type { LibraryItem } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ url }) => {
	const status = url.searchParams.get('status') as LibraryItem['status'] | null;
	const mediaType = url.searchParams.get('mediaType') as LibraryItem['mediaType'] | null;

	const items = await listLibraryItems({
		status: status ?? undefined,
		mediaType: mediaType ?? undefined
	});

	return { items, status, mediaType };
};
