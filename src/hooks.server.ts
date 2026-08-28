import { redirect, json } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE_NAME,
	validateSessionToken,
	setSessionCookie,
	deleteSessionCookie
} from '$lib/server/auth';

const PUBLIC_PATHS = new Set(['/login', '/registro']);

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE_NAME);

	if (!token) {
		event.locals.user = null;
		event.locals.session = null;
	} else {
		const result = await validateSessionToken(token);
		if (result) {
			event.locals.user = result.user;
			event.locals.session = result.session;
			if (result.renewedExpiresAt) {
				setSessionCookie(event.cookies, token, result.renewedExpiresAt);
			}
		} else {
			deleteSessionCookie(event.cookies);
			event.locals.user = null;
			event.locals.session = null;
		}
	}

	const isPublicRoute = PUBLIC_PATHS.has(event.url.pathname);

	if (!event.locals.user && !isPublicRoute) {
		if (event.url.pathname.startsWith('/api')) {
			return json({ error: 'No autenticado.' }, { status: 401 });
		}
		const redirectTo = encodeURIComponent(event.url.pathname + event.url.search);
		redirect(303, `/login?redirectTo=${redirectTo}`);
	}

	if (event.locals.user && isPublicRoute) {
		redirect(303, '/');
	}

	return resolve(event);
};
