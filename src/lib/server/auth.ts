import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { error, type Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { sessions, users, type User, type Session } from './db/schema';

const SCRYPT_N = 15; // log2(N), N = 2^15
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
// OpenSSL necesita ~128*N*r bytes (32MiB con los parámetros de arriba); el límite por
// defecto de Node es exactamente ese valor, así que hay que subirlo explícitamente.
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export const SESSION_COOKIE_NAME = 'session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const SESSION_RENEW_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000; // 15 días

/** Hashea una contraseña con scrypt. Formato: scrypt$N$r$p$salt$hash (todos en hex salvo N/r/p). */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const derivedKey = scryptSync(password.normalize('NFKC'), salt, SCRYPT_KEYLEN, {
		N: 2 ** SCRYPT_N,
		r: SCRYPT_R,
		p: SCRYPT_P,
		maxmem: SCRYPT_MAXMEM
	});
	return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

/** Verifica una contraseña contra un hash generado por `hashPassword`. */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	const parts = storedHash.split('$');
	if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
	const [, nStr, rStr, pStr, saltHex, hashHex] = parts;

	const salt = Buffer.from(saltHex, 'hex');
	const expected = Buffer.from(hashHex, 'hex');
	const derivedKey = scryptSync(password.normalize('NFKC'), salt, expected.length, {
		N: 2 ** Number(nStr),
		r: Number(rStr),
		p: Number(pStr),
		maxmem: SCRYPT_MAXMEM
	});

	return derivedKey.length === expected.length && timingSafeEqual(derivedKey, expected);
}

/** Genera un token de sesión aleatorio y seguro (es lo que se guarda en la cookie del cliente). */
export function generateSessionToken(): string {
	return randomBytes(32).toString('base64url');
}

function hashSessionToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/** Crea una sesión nueva en DB para `userId` y devuelve el token en claro (para la cookie). */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
	const token = generateSessionToken();
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
	await db.insert(sessions).values({ id: hashSessionToken(token), userId, expiresAt: expiresAt.toISOString() });
	return { token, expiresAt };
}

/**
 * Valida un token de sesión. Si es válido y le queda poco tiempo de vida, la renueva
 * (renovación deslizante) y devuelve la nueva expiración para que la llame reemita la cookie.
 */
export async function validateSessionToken(
	token: string
): Promise<{ user: User; session: Session; renewedExpiresAt: Date | null } | null> {
	const sessionId = hashSessionToken(token);

	const [row] = await db
		.select({ user: users, session: sessions })
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, sessionId));

	if (!row) return null;

	const expiresAt = new Date(row.session.expiresAt);
	if (expiresAt.getTime() <= Date.now()) {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
		return null;
	}

	let renewedExpiresAt: Date | null = null;
	if (expiresAt.getTime() - Date.now() < SESSION_RENEW_THRESHOLD_MS) {
		renewedExpiresAt = new Date(Date.now() + SESSION_DURATION_MS);
		await db
			.update(sessions)
			.set({ expiresAt: renewedExpiresAt.toISOString() })
			.where(eq(sessions.id, sessionId));
	}

	return { user: row.user, session: row.session, renewedExpiresAt };
}

/** Invalida (borra) una sesión por su id. Usado en logout. */
export async function invalidateSession(sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date): void {
	cookies.set(SESSION_COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		expires: expiresAt
	});
}

export function deleteSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}

/** Devuelve el usuario autenticado o lanza un 401 si no hay sesión. Da narrowing de tipo limpio. */
export function requireUser(locals: App.Locals): User {
	if (!locals.user) error(401, 'No autenticado.');
	return locals.user;
}
