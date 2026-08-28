import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { exchangeCodeForTokens, getTraktUsername, TRAKT_OAUTH_STATE_COOKIE } from '$lib/server/trakt';
import { saveTraktAccount } from '$lib/server/traktAccount';

export const GET: RequestHandler = async ({ locals, url, cookies }) => {
	const user = requireUser(locals);

	const expectedState = cookies.get(TRAKT_OAUTH_STATE_COOKIE);
	cookies.delete(TRAKT_OAUTH_STATE_COOKIE, { path: '/' });

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	if (!code || !state || !expectedState || state !== expectedState) {
		error(400, 'La solicitud de conexión con Trakt es inválida o expiró. Probá de nuevo.');
	}

	const redirectUri = `${url.origin}/api/trakt/callback`;
	const tokens = await exchangeCodeForTokens(code, redirectUri);
	const username = await getTraktUsername(tokens.accessToken).catch(() => null);

	await saveTraktAccount(user.id, tokens, username);

	redirect(303, '/ajustes');
};
