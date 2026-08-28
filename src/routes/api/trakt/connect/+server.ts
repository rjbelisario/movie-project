import { randomBytes } from 'node:crypto';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { requireUser } from '$lib/server/auth';
import { buildAuthorizeUrl, TRAKT_OAUTH_STATE_COOKIE } from '$lib/server/trakt';

/** Redirige al usuario a Trakt para autorizar la app, con un `state` anti-CSRF de un solo uso. */
export const GET: RequestHandler = async ({ locals, url, cookies }) => {
	requireUser(locals);

	const state = randomBytes(24).toString('base64url');
	cookies.set(TRAKT_OAUTH_STATE_COOKIE, state, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: 600
	});

	const redirectUri = `${url.origin}/api/trakt/callback`;
	redirect(303, buildAuthorizeUrl(redirectUri, state));
};
