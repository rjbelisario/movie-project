import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLibraryItem, updateLibraryItem, removeFromLibrary } from '$lib/server/library';
import type { LibraryItemPatch } from '$lib/server/library';

function parseId(param: string): number {
	const id = Number(param);
	if (!Number.isInteger(id)) {
		error(400, `id inválido: ${param}`);
	}
	return id;
}

export const GET: RequestHandler = async ({ params }) => {
	const id = parseId(params.id);
	const item = await getLibraryItem(id);
	if (!item) error(404, 'Item no encontrado en la biblioteca.');
	return json(item);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = parseId(params.id);
	const patch = (await request.json()) as LibraryItemPatch;

	const updated = await updateLibraryItem(id, patch);
	if (!updated) error(404, 'Item no encontrado en la biblioteca.');
	return json(updated);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = parseId(params.id);
	const removed = await removeFromLibrary(id);
	if (!removed) error(404, 'Item no encontrado en la biblioteca.');
	return new Response(null, { status: 204 });
};
