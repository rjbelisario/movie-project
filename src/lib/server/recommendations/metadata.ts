import {
	getMediaDetails,
	getCredits,
	getKeywords,
	type TmdbMediaDetails,
	type TmdbCredits,
	type TmdbGenre,
	type TmdbMediaType
} from '$lib/server/tmdb';
import { TtlCache } from './cache';

/**
 * Cache de metadata TMDb compartida por título (no por usuario). Es lo que realmente amortiza
 * el costo de llamadas a medida que hay más usuarios: un título enriquecido para el usuario A
 * se reutiliza gratis cuando aparece en el pool de recomendaciones del usuario B.
 */
const METADATA_TTL_MS = 12 * 60 * 60 * 1000;

const detailsCache = new TtlCache<TmdbMediaDetails | null>(METADATA_TTL_MS);
const creditsCache = new TtlCache<TmdbCredits>(METADATA_TTL_MS);
const keywordsCache = new TtlCache<TmdbGenre[]>(METADATA_TTL_MS);

function key(mediaType: TmdbMediaType, tmdbId: number): string {
	return `${mediaType}:${tmdbId}`;
}

/** `null` si TMDb falla (título borrado, timeout, etc.) — nunca lanza. */
export async function getCachedDetails(
	mediaType: TmdbMediaType,
	tmdbId: number
): Promise<TmdbMediaDetails | null> {
	return detailsCache.getOrCompute(key(mediaType, tmdbId), () =>
		getMediaDetails(mediaType, tmdbId).catch(() => null)
	);
}

export async function getCachedCredits(
	mediaType: TmdbMediaType,
	tmdbId: number
): Promise<TmdbCredits> {
	return creditsCache.getOrCompute(key(mediaType, tmdbId), () =>
		getCredits(mediaType, tmdbId).catch((): TmdbCredits => ({ cast: [], directors: [] }))
	);
}

export async function getCachedKeywords(
	mediaType: TmdbMediaType,
	tmdbId: number
): Promise<TmdbGenre[]> {
	return keywordsCache.getOrCompute(key(mediaType, tmdbId), () =>
		getKeywords(mediaType, tmdbId).catch((): TmdbGenre[] => [])
	);
}
