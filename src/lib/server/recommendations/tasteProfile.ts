import { listLibraryItems } from '$lib/server/library';
import type { LibraryItem } from '$lib/server/db/schema';
import { mapWithConcurrency } from '$lib/server/concurrency';
import { getCachedDetails, getCachedCredits, getCachedKeywords } from './metadata';
import { addAffinity } from './affinity';
import type { GenreDirectory, TasteProfile } from './types';

/** Mínimo de títulos `completed` para intentar personalización de contenido (cold-start de usuario). */
const MIN_COMPLETED_FOR_PROFILE = 3;
/** Cuántos títulos mejor pesados se enriquecen con llamadas caras a TMDb (país/reparto/keywords). */
const ENRICH_TOP_N = 8;
/** Cuántos títulos mejor pesados se usan como semilla de `similar`/`recommendations`. */
const SEED_TOP_N = 5;
const ENRICH_CONCURRENCY = 8;
/** Cuántos miembros del reparto (de los ~12 que trae `getCredits`) cuentan para afinidad. */
const CAST_AFFINITY_SIZE = 5;
const RECENCY_HALF_LIFE_DAYS = 180;
const RECENCY_FLOOR = 0.3;

const RATING_WEIGHTS: Record<number, number> = {
	1: -1.5,
	2: -0.5,
	3: 0.3,
	4: 1,
	5: 1.5
};
const NO_RATING_WEIGHT = 0.5;

function ratingWeight(rating: number | null): number {
	if (rating === null) return NO_RATING_WEIGHT;
	return RATING_WEIGHTS[rating] ?? NO_RATING_WEIGHT;
}

function recencyDecay(updatedAt: string): number {
	const daysSince = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
	return Math.max(RECENCY_FLOOR, Math.exp(-daysSince / RECENCY_HALF_LIFE_DAYS));
}

function itemWeight(item: LibraryItem): number {
	return ratingWeight(item.rating) * recencyDecay(item.updatedAt);
}

export function decadeOf(releaseDate: string | null): number | null {
	if (!releaseDate) return null;
	const year = Number(releaseDate.slice(0, 4));
	if (!Number.isInteger(year)) return null;
	return Math.floor(year / 10) * 10;
}

function emptyProfile(): TasteProfile {
	return {
		hasContentProfile: false,
		genreScores: new Map(),
		decadeScores: new Map(),
		countryScores: new Map(),
		castScores: new Map(),
		castNames: new Map(),
		directorScores: new Map(),
		keywordScores: new Map(),
		keywordNames: new Map(),
		seedItems: []
	};
}

export async function buildTasteProfile(
	userId: string,
	genreDirectory: GenreDirectory
): Promise<TasteProfile> {
	const completedItems = await listLibraryItems(userId, { status: 'completed' });
	if (completedItems.length < MIN_COMPLETED_FOR_PROFILE) {
		return emptyProfile();
	}

	const profile = emptyProfile();
	profile.hasContentProfile = true;

	for (const item of completedItems) {
		const weight = itemWeight(item);

		for (const genreName of item.genres) {
			const genreId = genreDirectory.nameToId.get(genreName);
			if (genreId !== undefined) addAffinity(profile.genreScores, genreId, weight);
		}

		const decade = decadeOf(item.releaseDate);
		if (decade !== null) addAffinity(profile.decadeScores, decade, weight);
	}

	const topItems = [...completedItems].sort((a, b) => itemWeight(b) - itemWeight(a));

	profile.seedItems = topItems.slice(0, SEED_TOP_N).map((item) => ({
		tmdbId: item.tmdbId,
		mediaType: item.mediaType,
		weight: itemWeight(item)
	}));

	const enrichTargets = topItems.slice(0, ENRICH_TOP_N);
	await mapWithConcurrency(enrichTargets, ENRICH_CONCURRENCY, async (item) => {
		const weight = itemWeight(item);
		const [details, credits, keywords] = await Promise.all([
			getCachedDetails(item.mediaType, item.tmdbId),
			getCachedCredits(item.mediaType, item.tmdbId),
			getCachedKeywords(item.mediaType, item.tmdbId)
		]);

		if (details) {
			for (const country of details.originCountry) {
				addAffinity(profile.countryScores, country, weight);
			}
		}

		for (const member of credits.cast.slice(0, CAST_AFFINITY_SIZE)) {
			addAffinity(profile.castScores, member.id, weight);
			profile.castNames.set(member.id, member.name);
		}

		const directorNames =
			item.mediaType === 'movie' ? credits.directors : (details?.creators ?? []);
		for (const name of directorNames) {
			addAffinity(profile.directorScores, name, weight);
		}

		for (const keyword of keywords) {
			addAffinity(profile.keywordScores, keyword.id, weight);
			profile.keywordNames.set(keyword.id, keyword.name);
		}
	});

	return profile;
}
