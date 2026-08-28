import { getTrending, type TmdbSearchResultItem } from '$lib/server/tmdb';
import { listLibraryItems } from '$lib/server/library';
import { topPositiveKeys } from './affinity';
import { generateCandidates } from './candidates';
import { getCfContext, predictForUser, normalizeCfScore } from './collaborativeFiltering';
import { getGenreDirectory } from './genreDirectory';
import {
	buildReasons,
	computeProfileBounds,
	enrichAndScoreFine,
	scoreCoarse,
	selectExploration,
	selectWithDiversity
} from './scoring';
import { buildTasteProfile } from './tasteProfile';
import { TtlCache } from './cache';
import { itemKey, type GenreDirectory, type RecommendedItem, type ScoredCandidate } from './types';

export interface RecommendationsResult {
	items: RecommendedItem[];
	/** Resto del pool ya calculado (coarse-only, sin CF) para el botón "ver más" — no implica
	 * llamadas nuevas a TMDb, solo se revela client-side. */
	moreItems: RecommendedItem[];
}

const RESULT_CACHE_TTL_MS = 12 * 60 * 1000;
const resultCache = new TtlCache<RecommendationsResult>(RESULT_CACHE_TTL_MS);

const COARSE_POOL_SIZE = 30;
const FINE_SHORTLIST_SIZE = 15;
const PERSONALIZED_COUNT = 12;
const EXPLORATION_COUNT = 3;
const DOMINANT_GENRES_FOR_EXPLORATION = 2;
const TRENDING_FALLBACK_COUNT = 15;

function resolveGenres(genreIds: number[], genreDirectory: GenreDirectory): string[] {
	return genreIds
		.map((id) => genreDirectory.idToName.get(id))
		.filter((name): name is string => name !== undefined);
}

function toRecommendedItem(
	item: Pick<
		TmdbSearchResultItem,
		'tmdbId' | 'mediaType' | 'title' | 'overview' | 'posterPath' | 'releaseDate'
	> & { genreIds?: number[] },
	genreDirectory: GenreDirectory,
	reasons: string[]
): RecommendedItem {
	return {
		tmdbId: item.tmdbId,
		mediaType: item.mediaType,
		title: item.title,
		overview: item.overview,
		posterPath: item.posterPath,
		releaseDate: item.releaseDate,
		genres: resolveGenres(item.genreIds ?? [], genreDirectory),
		reasons
	};
}

async function fallbackToTrending(
	excludeKeys: Set<string>,
	genreDirectory: GenreDirectory,
	message: string
): Promise<RecommendationsResult> {
	const trending = await getTrending('week').catch((): TmdbSearchResultItem[] => []);
	const available = trending.filter(
		(item) => !excludeKeys.has(itemKey(item.mediaType, item.tmdbId))
	);
	return {
		items: available
			.slice(0, TRENDING_FALLBACK_COUNT)
			.map((item) => toRecommendedItem(item, genreDirectory, [message])),
		moreItems: available
			.slice(TRENDING_FALLBACK_COUNT)
			.map((item) => toRecommendedItem(item, genreDirectory, [message]))
	};
}

async function computeRecommendations(userId: string): Promise<RecommendationsResult> {
	const genreDirectory = await getGenreDirectory();
	const [profile, allLibraryItems] = await Promise.all([
		buildTasteProfile(userId, genreDirectory),
		listLibraryItems(userId, {})
	]);
	const excludeKeys = new Set(
		allLibraryItems.map((item) => itemKey(item.mediaType, item.tmdbId))
	);

	if (!profile.hasContentProfile) {
		return fallbackToTrending(
			excludeKeys,
			genreDirectory,
			'Tendencia esta semana — calificá algunos títulos para recomendaciones personalizadas'
		);
	}

	const candidates = await generateCandidates(profile, excludeKeys);
	if (candidates.length === 0) {
		return fallbackToTrending(
			excludeKeys,
			genreDirectory,
			'Tendencia esta semana — no encontramos candidatos personalizados en este momento'
		);
	}

	const bounds = computeProfileBounds(profile);
	const positiveSeedWeights = profile.seedItems.map((seed) => seed.weight).filter((w) => w > 0);
	const seedWeightMax = positiveSeedWeights.length > 0 ? Math.max(...positiveSeedWeights) : 0;

	const coarseScored = scoreCoarse(candidates, profile, genreDirectory, bounds, seedWeightMax).sort(
		(a, b) => b.contentScore - a.contentScore
	);

	const top30 = coarseScored.slice(0, COARSE_POOL_SIZE);
	const fineTargets = top30.slice(0, FINE_SHORTLIST_SIZE);
	const explorationPool = top30.slice(FINE_SHORTLIST_SIZE);

	const fineScored = await enrichAndScoreFine(fineTargets, profile, genreDirectory, bounds);

	const cf = await getCfContext();
	const blended: ScoredCandidate[] = fineScored.map((candidate) => {
		const prediction = predictForUser(cf, userId, candidate.mediaType, candidate.tmdbId);
		if (!prediction) return candidate;

		const cfNorm = normalizeCfScore(prediction.predictedRating);
		const finalScore = (1 - prediction.weight) * candidate.contentScore + prediction.weight * cfNorm;
		return { ...candidate, finalScore, cfContribution: prediction.weight };
	});

	const personalized = selectWithDiversity(blended, PERSONALIZED_COUNT);

	const dominantGenreIds = new Set(topPositiveKeys(profile.genreScores, DOMINANT_GENRES_FOR_EXPLORATION));
	const exploration = selectExploration(explorationPool, dominantGenreIds, EXPLORATION_COUNT);

	const personalizedItems = personalized.map((candidate) =>
		toRecommendedItem(candidate, genreDirectory, buildReasons(candidate))
	);
	const explorationItems = exploration.map((candidate) =>
		toRecommendedItem(candidate, genreDirectory, [
			'Para salir de tu zona de confort',
			...buildReasons(candidate).filter((reason) => reason !== 'Recomendado para vos')
		])
	);
	const items = [...personalizedItems, ...explorationItems];

	// "Ver más": el resto del pool coarse ya calculado (sin costo extra de TMDb), excluyendo lo
	// que ya se muestra arriba. Es deliberadamente menos curado (sin fine re-rank ni CF). No se
	// recorta a un número fijo — ya viene acotado por el cap del pool de candidatos (~120), y el
	// cliente lo pagina en tandas para que "ver más" se pueda pisar varias veces.
	const usedKeys = new Set(items.map((item) => itemKey(item.mediaType, item.tmdbId)));
	const moreItems = coarseScored
		.filter((candidate) => !usedKeys.has(itemKey(candidate.mediaType, candidate.tmdbId)))
		.map((candidate) => toRecommendedItem(candidate, genreDirectory, buildReasons(candidate)));

	return { items, moreItems };
}

export async function getRecommendationsForUser(userId: string): Promise<RecommendationsResult> {
	return resultCache.getOrCompute(userId, () => computeRecommendations(userId));
}

export function invalidateRecommendationsCache(userId: string): void {
	resultCache.delete(userId);
}

export type { RecommendedItem };
