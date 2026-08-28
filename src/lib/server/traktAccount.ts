import { eq } from 'drizzle-orm';
import { db } from './db';
import { traktAccounts, type TraktAccount } from './db/schema';
import { refreshTokens, type TraktTokens } from './trakt';

/** Margen antes de la expiración real en el que ya refrescamos el token, para no llegar justo. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** Devuelve la cuenta de Trakt conectada de `userId`, o `undefined` si no conectó ninguna. */
export async function getTraktAccount(userId: string): Promise<TraktAccount | undefined> {
	const [account] = await db.select().from(traktAccounts).where(eq(traktAccounts.userId, userId));
	return account;
}

/** Guarda (crea o reemplaza) los tokens y el username de Trakt de `userId`. */
export async function saveTraktAccount(
	userId: string,
	tokens: TraktTokens,
	traktUsername: string | null
): Promise<void> {
	await db
		.insert(traktAccounts)
		.values({
			userId,
			traktUsername,
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			expiresAt: tokens.expiresAt
		})
		.onConflictDoUpdate({
			target: traktAccounts.userId,
			set: {
				traktUsername,
				accessToken: tokens.accessToken,
				refreshToken: tokens.refreshToken,
				expiresAt: tokens.expiresAt
			}
		});
}

/** Desconecta la cuenta de Trakt de `userId`. Idempotente. */
export async function deleteTraktAccount(userId: string): Promise<void> {
	await db.delete(traktAccounts).where(eq(traktAccounts.userId, userId));
}

export async function markTraktSynced(userId: string): Promise<void> {
	await db
		.update(traktAccounts)
		.set({ lastSyncedAt: new Date().toISOString() })
		.where(eq(traktAccounts.userId, userId));
}

/**
 * Devuelve un access token de Trakt válido para `userId`, refrescándolo primero si está por
 * expirar. Lanza si el usuario no tiene ninguna cuenta de Trakt conectada.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
	const account = await getTraktAccount(userId);
	if (!account) throw new Error('El usuario no tiene una cuenta de Trakt conectada.');

	const expiresAt = new Date(account.expiresAt).getTime();
	if (expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
		return account.accessToken;
	}

	const tokens = await refreshTokens(account.refreshToken);
	await saveTraktAccount(userId, tokens, account.traktUsername);
	return tokens.accessToken;
}
