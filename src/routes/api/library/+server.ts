import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listLibraryItems, addToLibrary } from '$lib/server/library';
import type { LibraryItem, NewLibraryItem } from '$lib/server/db/schema';

const VALID_STATUS: LibraryItem['status'][] = ['planned', 'completed'];
const VALID_MEDIA_TYPE: LibraryItem['mediaType'][] = ['movie', 'tv'];

export const GET: RequestHandler = async ({ url }) => {
	const status = url.searchParams.get('status');
	const mediaType = url.searchParams.get('mediaType');

	if (status && !VALID_STATUS.includes(status as LibraryItem['status'])) {
		error(400, `status inválido: ${status}`);
	}
	if (mediaType && !VALID_MEDIA_TYPE.includes(mediaType as LibraryItem['mediaType'])) {
		error(400, `mediaType inválido: ${mediaType}`);
	}

	const items = await listLibraryItems({
		status: (status as LibraryItem['status']) ?? undefined,
		mediaType: (mediaType as LibraryItem['mediaType']) ?? undefined
	});
	return json(items);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as Partial<NewLibraryItem>;

	if (!body.tmdbId || !body.mediaType || !body.title) {
		error(400, 'tmdbId, mediaType y title son obligatorios.');
	}
	if (!VALID_MEDIA_TYPE.includes(body.mediaType)) {
		error(400, `mediaType inválido: ${body.mediaType}`);
	}

	const created = await addToLibrary({
		tmdbId: body.tmdbId,
		mediaType: body.mediaType,
		title: body.title,
		posterPath: body.posterPath ?? null,
		overview: body.overview ?? null,
		releaseDate: body.releaseDate ?? null,
		genres: body.genres ?? [],
		status: body.status ?? 'planned',
		rating: body.rating ?? null,
		notes: body.notes ?? null
	});
	return json(created, { status: 201 });
};
