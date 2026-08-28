import { env } from '$env/dynamic/private';

/**
 * Cliente server-side de la API de Trakt (https://trakt.docs.apiary.io/), usado para el
 * flujo OAuth y para importar el historial de visto/pendientes de un usuario.
 *
 * IMPORTANTE: este módulo nunca debe importarse desde código que se ejecute en el cliente,
 * ya que maneja el client secret y tokens de acceso de usuarios.
 */

const TRAKT_SITE_URL = 'https://trakt.tv';
const TRAKT_API_URL = 'https://api.trakt.tv';
const TRAKT_API_VERSION = '2';

/** Cookie que guarda el `state` anti-CSRF entre `/api/trakt/connect` y `/api/trakt/callback`. */
export const TRAKT_OAUTH_STATE_COOKIE = 'trakt_oauth_state';

function getClientId(): string {
	const clientId = env.TRAKT_CLIENT_ID;
	if (!clientId) {
		throw new Error(
			'TRAKT_CLIENT_ID no está configurada. Registrá una app en https://trakt.tv/oauth/applications y definí TRAKT_CLIENT_ID en tu .env.'
		);
	}
	return clientId;
}

function getClientSecret(): string {
	const clientSecret = env.TRAKT_CLIENT_SECRET;
	if (!clientSecret) {
		throw new Error(
			'TRAKT_CLIENT_SECRET no está configurada. Registrá una app en https://trakt.tv/oauth/applications y definí TRAKT_CLIENT_SECRET en tu .env.'
		);
	}
	return clientSecret;
}

export interface TraktTokens {
	accessToken: string;
	refreshToken: string;
	/** Fecha ISO de expiración del access token. */
	expiresAt: string;
}

interface TraktRawTokenResponse {
	access_token: string;
	refresh_token: string;
	expires_in: number;
}

function tokensFromResponse(data: TraktRawTokenResponse): TraktTokens {
	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString()
	};
}

/** URL de autorización a la que se redirige al usuario para conectar su cuenta de Trakt. */
export function buildAuthorizeUrl(redirectUri: string, state: string): string {
	const url = new URL('/oauth/authorize', TRAKT_SITE_URL);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('client_id', getClientId());
	url.searchParams.set('redirect_uri', redirectUri);
	url.searchParams.set('state', state);
	return url.toString();
}

async function tokenRequest(body: Record<string, string>): Promise<TraktTokens> {
	const response = await fetch(`${TRAKT_API_URL}/oauth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			...body,
			client_id: getClientId(),
			client_secret: getClientSecret()
		})
	});

	if (!response.ok) {
		throw new Error(`Error de Trakt (${response.status} ${response.statusText}) al pedir tokens.`);
	}

	return tokensFromResponse((await response.json()) as TraktRawTokenResponse);
}

/** Intercambia el `code` de la redirección OAuth por un access/refresh token. */
export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TraktTokens> {
	return tokenRequest({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' });
}

/** Pide un nuevo access token usando el refresh token guardado. */
export async function refreshTokens(refreshToken: string): Promise<TraktTokens> {
	return tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
}

async function traktFetch<T>(path: string, accessToken: string): Promise<T> {
	const response = await fetch(`${TRAKT_API_URL}${path}`, {
		headers: {
			'Content-Type': 'application/json',
			'trakt-api-version': TRAKT_API_VERSION,
			'trakt-api-key': getClientId(),
			Authorization: `Bearer ${accessToken}`
		}
	});

	if (!response.ok) {
		throw new Error(`Error de Trakt (${response.status} ${response.statusText}) al solicitar ${path}.`);
	}

	return (await response.json()) as T;
}

/** Username de Trakt del usuario dueño del token, para mostrarlo en la UI. */
export async function getTraktUsername(accessToken: string): Promise<string | null> {
	const data = await traktFetch<{ user: { username: string | null } }>('/users/settings', accessToken);
	return data.user.username;
}

interface TraktIds {
	trakt: number;
	slug: string;
	imdb: string | null;
	tmdb: number | null;
}

interface TraktRawMovie {
	title: string;
	year: number | null;
	ids: TraktIds;
}

interface TraktRawShow {
	title: string;
	year: number | null;
	ids: TraktIds;
}

export interface TraktWatchedMovie {
	movie: TraktRawMovie;
}

export interface TraktWatchedEpisode {
	number: number;
}

export interface TraktWatchedSeason {
	number: number;
	episodes: TraktWatchedEpisode[];
}

export interface TraktWatchedShow {
	show: TraktRawShow;
	seasons: TraktWatchedSeason[];
}

export interface TraktWatchlistMovie {
	movie: TraktRawMovie;
}

export interface TraktWatchlistShow {
	show: TraktRawShow;
}

/** Películas marcadas como vistas en Trakt (`/sync/watched/movies`). No pagina: siempre completo. */
export function getWatchedMovies(accessToken: string): Promise<TraktWatchedMovie[]> {
	return traktFetch('/sync/watched/movies', accessToken);
}

/** Series marcadas como vistas en Trakt, con detalle de temporada/episodio (`/sync/watched/shows`). */
export function getWatchedShows(accessToken: string): Promise<TraktWatchedShow[]> {
	return traktFetch('/sync/watched/shows', accessToken);
}

/** Watchlist de películas del usuario (`/sync/watchlist/movies`). */
export function getWatchlistMovies(accessToken: string): Promise<TraktWatchlistMovie[]> {
	return traktFetch('/sync/watchlist/movies', accessToken);
}

/** Watchlist de series del usuario (`/sync/watchlist/shows`). */
export function getWatchlistShows(accessToken: string): Promise<TraktWatchlistShow[]> {
	return traktFetch('/sync/watchlist/shows', accessToken);
}
