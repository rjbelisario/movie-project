import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '$lib/server/auth';
import { getRecommendationsForUser, invalidateRecommendationsCache } from '$lib/server/recommendations';

export const load: PageServerLoad = ({ locals }) => {
	const user = requireUser(locals);
	// Sin await: el cálculo puede tardar unos segundos (candidatos + re-rank fino contra TMDb),
	// así que se pasa la promesa sin resolver y `+page.svelte` la consume con `{#await}` —
	// SvelteKit hace streaming del resto de la página mientras se calcula.
	return { recommendations: getRecommendationsForUser(user.id) };
};

export const actions: Actions = {
	refresh: ({ locals }) => {
		const user = requireUser(locals);
		invalidateRecommendationsCache(user.id);
	}
};
