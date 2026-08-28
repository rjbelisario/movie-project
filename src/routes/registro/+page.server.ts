import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { hashPassword, createSession, setSessionCookie } from '$lib/server/auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, '/');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(data.get('password') ?? '');

		if (!EMAIL_REGEX.test(email)) {
			return fail(400, { error: 'Ingresá un email válido.', email });
		}
		if (password.length < MIN_PASSWORD_LENGTH) {
			return fail(400, {
				error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
				email
			});
		}

		const passwordHash = await hashPassword(password);

		let userId: string;
		try {
			const [created] = await db.insert(users).values({ email, passwordHash }).returning();
			userId = created.id;
		} catch (err) {
			if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
				return fail(400, { error: 'Ese email ya está registrado.', email });
			}
			throw err;
		}

		const { token, expiresAt } = await createSession(userId);
		setSessionCookie(cookies, token, expiresAt);

		redirect(303, '/');
	}
};
