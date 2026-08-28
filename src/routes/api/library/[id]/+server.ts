import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLibraryItem, updateLibraryItem, removeFromLibrary } from '$lib/server/library';
import { requireUser } from '$lib/server/auth';
import { invalidateRecommendationsCache } from '$lib/server/recommendations';
import type { LibraryItemPatch } from '$lib/server/library';

function parseId(param: string): number {
	const id = Number(param);
	if (!Number.isInteger(id)) {
		error(400, `id inválido: ${param}`);
	}
	return id;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);
	const id = parseId(params.id);
	const item = await getLibraryItem(user.id, id);
	if (!item) error(404, 'Item no encontrado en la biblioteca.');
	return json(item);
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const user = requireUser(locals);
	const id = parseId(params.id);
	const patch = (await request.json()) as LibraryItemPatch;

	const updated = await updateLibraryItem(user.id, id, patch);
	if (!updated) error(404, 'Item no encontrado en la biblioteca.');
	invalidateRecommendationsCache(user.id);
	return json(updated);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);
	const id = parseId(params.id);
	const removed = await removeFromLibrary(user.id, id);
	if (!removed) error(404, 'Item no encontrado en la biblioteca.');
	invalidateRecommendationsCache(user.id);
	return new Response(null, { status: 204 });
};
