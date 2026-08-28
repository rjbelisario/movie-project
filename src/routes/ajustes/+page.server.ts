import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '$lib/server/auth';
import { getTraktAccount, deleteTraktAccount } from '$lib/server/traktAccount';
import { syncTraktLibrary } from '$lib/server/traktSync';
import { invalidateRecommendationsCache } from '$lib/server/recommendations';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const account = await getTraktAccount(user.id);

	return {
		trakt: account
			? { username: account.traktUsername, lastSyncedAt: account.lastSyncedAt }
			: null
	};
};

export const actions: Actions = {
	sync: async ({ locals }) => {
		const user = requireUser(locals);

		try {
			const summary = await syncTraktLibrary(user.id);
			invalidateRecommendationsCache(user.id);
			return { synced: true, summary };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'No se pudo sincronizar con Trakt.'
			});
		}
	},

	disconnect: async ({ locals }) => {
		const user = requireUser(locals);
		await deleteTraktAccount(user.id);
		return { disconnected: true };
	}
};
