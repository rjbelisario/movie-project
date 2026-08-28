import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { verifyPassword, createSession, setSessionCookie } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, '/');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(data.get('password') ?? '');

		if (!email || !password) {
			return fail(400, { error: 'Email y contraseña son obligatorios.', email });
		}

		const [user] = await db.select().from(users).where(eq(users.email, email));

		const genericError = 'Email o contraseña incorrectos.';
		if (!user) {
			return fail(400, { error: genericError, email });
		}

		const validPassword = await verifyPassword(password, user.passwordHash);
		if (!validPassword) {
			return fail(400, { error: genericError, email });
		}

		const { token, expiresAt } = await createSession(user.id);
		setSessionCookie(cookies, token, expiresAt);

		const redirectTo = url.searchParams.get('redirectTo');
		redirect(303, redirectTo && redirectTo.startsWith('/') ? redirectTo : '/');
	}
};
