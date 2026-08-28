import {
	getSimilar,
	getRecommendations,
	discoverTitles,
	type TmdbMediaType,
	type TmdbSearchResultItem
} from '$lib/server/tmdb';
import { mapWithConcurrency } from '$lib/server/concurrency';
import { topPositiveKeys } from './affinity';
import { itemKey } from './types';
import type { Candidate, TasteProfile } from './types';

const CANDIDATE_POOL_CAP = 120;
const SEED_CALL_CONCURRENCY = 8;
const TOP_KEYWORDS_FOR_DISCOVER = 5;

function toCandidate(raw: TmdbSearchResultItem, provenanceWeight: number): Candidate {
	return {
		tmdbId: raw.tmdbId,
		mediaType: raw.mediaType,
		title: raw.title,
		overview: raw.overview,
		posterPath: raw.posterPath,
		releaseDate: raw.releaseDate,
		genreIds: raw.genreIds,
		voteAverage: raw.voteAverage,
		voteCount: raw.voteCount,
		popularity: raw.popularity,
		originalLanguage: raw.originalLanguage,
		originCountry: raw.originCountry,
		provenanceWeight
	};
}

function majorityMediaType(items: { mediaType: TmdbMediaType }[]): TmdbMediaType {
	const movieCount = items.filter((item) => item.mediaType === 'movie').length;
	const tvCount = items.length - movieCount;
	return tvCount > movieCount ? 'tv' : 'movie';
}

export async function generateCandidates(
	profile: TasteProfile,
	excludeKeys: Set<string>
): Promise<Candidate[]> {
	const positiveSeeds = profile.seedItems.filter((seed) => seed.weight > 0);
	const pool = new Map<string, Candidate>();

	function merge(items: TmdbSearchResultItem[], provenanceWeight: number) {
		for (const raw of items) {
			const key = itemKey(raw.mediaType, raw.tmdbId);
			if (excludeKeys.has(key)) continue;
			const existing = pool.get(key);
			if (!existing || provenanceWeight > existing.provenanceWeight) {
				pool.set(key, toCandidate(raw, provenanceWeight));
			}
		}
	}

	// Etapa B.1: similar + recommendations de cada semilla (títulos que le gustaron al usuario).
	type SeedTask = { fetch: () => Promise<TmdbSearchResultItem[]>; weight: number };
	const seedTasks: SeedTask[] = positiveSeeds.flatMap((seed) => [
		{ fetch: () => getSimilar(seed.mediaType, seed.tmdbId).catch(() => []), weight: seed.weight },
		{
			fetch: () => getRecommendations(seed.mediaType, seed.tmdbId).catch(() => []),
			weight: seed.weight
		}
	]);
	const seedResults = await mapWithConcurrency(seedTasks, SEED_CALL_CONCURRENCY, (task) =>
		task.fetch()
	);
	seedResults.forEach((items, index) => merge(items, seedTasks[index].weight));

	// Etapa B.2: discover por géneros dominantes del perfil (AND, como ya soporta with_genres).
	const mediaType = majorityMediaType(
		positiveSeeds.length > 0 ? positiveSeeds : profile.seedItems
	);
	const topGenreIds = topPositiveKeys(profile.genreScores, 2);
	if (topGenreIds.length > 0) {
		const byTopGenre = await discoverTitles(mediaType, { genreIds: [topGenreIds[0]] }).catch(
			() => []
		);
		merge(byTopGenre, 0);
	}
	if (topGenreIds.length > 1) {
		const byGenreCombo = await discoverTitles(mediaType, { genreIds: topGenreIds }).catch(
			() => []
		);
		merge(byGenreCombo, 0);
	}

	// Etapa B.3: discover por keywords dominantes (OR — ver nota en DiscoverFilters.keywordIds).
	const topKeywordIds = topPositiveKeys(profile.keywordScores, TOP_KEYWORDS_FOR_DISCOVER);
	if (topKeywordIds.length > 0) {
		const byKeywords = await discoverTitles(mediaType, { keywordIds: topKeywordIds }).catch(
			() => []
		);
		merge(byKeywords, 0);
	}

	const candidates = [...pool.values()].sort((a, b) => {
		const provenanceRank = (b.provenanceWeight > 0 ? 1 : 0) - (a.provenanceWeight > 0 ? 1 : 0);
		if (provenanceRank !== 0) return provenanceRank;
		return b.popularity - a.popularity;
	});

	return candidates.slice(0, CANDIDATE_POOL_CAP);
}
