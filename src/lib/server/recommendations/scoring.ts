import { mapWithConcurrency } from '$lib/server/concurrency';
import { getCachedDetails, getCachedCredits, getCachedKeywords } from './metadata';
import {
	affinityBounds,
	averageMatchScore,
	matchScore,
	bestMatchingKey,
	type AffinityBounds
} from './affinity';
import { decadeOf } from './tasteProfile';
import type { Candidate, GenreDirectory, ScoreBreakdown, ScoredCandidate, TasteProfile } from './types';

const FINE_RERANK_CONCURRENCY = 8;

/** Pesan sumado 1.0. Las señales que todavía no se enriquecieron (país de película, reparto,
 * director, keywords) entran con valor neutro 0.5 — ni ayudan ni perjudican al coarse ranking.
 * No hay señal de idioma: casi todo el catálogo cae en el mismo puñado de idiomas (es un
 * artefacto de qué se dobla/subtitula, no un indicador real de gusto), así que no discrimina. */
const WEIGHTS = {
	genre: 0.24,
	decade: 0.09,
	country: 0.11,
	cast: 0.13,
	director: 0.11,
	keyword: 0.14,
	quality: 0.11,
	provenance: 0.07
};

/** Umbral de votos para el prior de calidad bayesiano (una nota de 9 con 3 votos no debe pesar
 * más que una de 7.5 con 5000 votos). `GLOBAL_AVERAGE` es la media típica de TMDb (~6.5/10). */
const QUALITY_VOTE_PRIOR = 500;
const QUALITY_GLOBAL_AVERAGE = 6.5;

function bayesianQuality(voteAverage: number, voteCount: number): number {
	const v = voteCount;
	const m = QUALITY_VOTE_PRIOR;
	const score = (v / (v + m)) * voteAverage + (m / (v + m)) * QUALITY_GLOBAL_AVERAGE;
	return score / 10;
}

interface ProfileBounds {
	genre: AffinityBounds;
	decade: AffinityBounds;
	country: AffinityBounds;
	cast: AffinityBounds;
	director: AffinityBounds;
	keyword: AffinityBounds;
}

export function computeProfileBounds(profile: TasteProfile): ProfileBounds {
	return {
		genre: affinityBounds(profile.genreScores),
		decade: affinityBounds(profile.decadeScores),
		country: affinityBounds(profile.countryScores),
		cast: affinityBounds(profile.castScores),
		director: affinityBounds(profile.directorScores),
		keyword: affinityBounds(profile.keywordScores)
	};
}

function computeContentScore(breakdown: ScoreBreakdown): number {
	return (
		WEIGHTS.genre * breakdown.genre +
		WEIGHTS.decade * breakdown.decade +
		WEIGHTS.country * breakdown.country +
		WEIGHTS.cast * breakdown.cast +
		WEIGHTS.director * breakdown.director +
		WEIGHTS.keyword * breakdown.keyword +
		WEIGHTS.quality * breakdown.quality +
		WEIGHTS.provenance * breakdown.provenance
	);
}

function provenanceScore(candidate: Candidate, seedWeightMax: number): number {
	if (candidate.provenanceWeight <= 0 || seedWeightMax <= 0) return 0;
	return Math.min(1, candidate.provenanceWeight / seedWeightMax);
}

/** Coarse ranking: solo señales gratis (ya incluidas en cualquier respuesta de lista de TMDb). */
export function scoreCoarse(
	candidates: Candidate[],
	profile: TasteProfile,
	genreDirectory: GenreDirectory,
	bounds: ProfileBounds,
	seedWeightMax: number
): ScoredCandidate[] {
	return candidates.map((candidate) => {
		const decade = decadeOf(candidate.releaseDate);
		// El país de origen solo viene gratis en listas de TV; en movie hay que esperar al fine re-rank.
		const country =
			candidate.mediaType === 'tv'
				? averageMatchScore(profile.countryScores, bounds.country, candidate.originCountry)
				: 0.5;

		const breakdown: ScoreBreakdown = {
			genre: averageMatchScore(profile.genreScores, bounds.genre, candidate.genreIds),
			decade: decade !== null ? matchScore(profile.decadeScores, bounds.decade, decade) : 0.5,
			country,
			cast: 0.5,
			director: 0.5,
			keyword: 0.5,
			quality: bayesianQuality(candidate.voteAverage, candidate.voteCount),
			provenance: provenanceScore(candidate, seedWeightMax),
			topGenreName: resolveGenreName(
				bestMatchingKey(profile.genreScores, candidate.genreIds),
				genreDirectory
			),
			topCastName: null,
			topDirectorName: null,
			topKeywordName: null
		};

		const contentScore = computeContentScore(breakdown);
		return {
			...candidate,
			breakdown,
			contentScore,
			enriched: false,
			finalScore: contentScore,
			cfContribution: null
		};
	});
}

function resolveGenreName(genreId: number | null, genreDirectory: GenreDirectory): string | null {
	if (genreId === null) return null;
	return genreDirectory.idToName.get(genreId) ?? null;
}

/** Fine re-rank: enriquece con llamadas caras (detalle/reparto/keywords) y recalcula el score
 * completo. Solo debe aplicarse a un shortlist chico (~15) por el costo de estas llamadas. */
export async function enrichAndScoreFine(
	scored: ScoredCandidate[],
	profile: TasteProfile,
	genreDirectory: GenreDirectory,
	bounds: ProfileBounds
): Promise<ScoredCandidate[]> {
	return mapWithConcurrency(scored, FINE_RERANK_CONCURRENCY, async (candidate) => {
		const [details, credits, keywords] = await Promise.all([
			getCachedDetails(candidate.mediaType, candidate.tmdbId),
			getCachedCredits(candidate.mediaType, candidate.tmdbId),
			getCachedKeywords(candidate.mediaType, candidate.tmdbId)
		]);

		const originCountry = details?.originCountry ?? candidate.originCountry;
		const castIds = credits.cast.map((member) => member.id);
		const directorNames =
			candidate.mediaType === 'movie' ? credits.directors : (details?.creators ?? []);
		const keywordIds = keywords.map((keyword) => keyword.id);

		const bestCastId = bestMatchingKey(profile.castScores, castIds);
		const bestKeywordId = bestMatchingKey(profile.keywordScores, keywordIds);

		const breakdown: ScoreBreakdown = {
			...candidate.breakdown,
			country:
				originCountry.length > 0
					? averageMatchScore(profile.countryScores, bounds.country, originCountry)
					: candidate.breakdown.country,
			cast: averageMatchScore(profile.castScores, bounds.cast, castIds),
			director: averageMatchScore(profile.directorScores, bounds.director, directorNames),
			keyword: averageMatchScore(profile.keywordScores, bounds.keyword, keywordIds),
			topCastName: bestCastId !== null ? (profile.castNames.get(bestCastId) ?? null) : null,
			topDirectorName: bestMatchingKey(profile.directorScores, directorNames),
			topKeywordName: bestKeywordId !== null ? (profile.keywordNames.get(bestKeywordId) ?? null) : null
		};

		const contentScore = computeContentScore(breakdown);
		return {
			...candidate,
			originCountry,
			breakdown,
			contentScore,
			enriched: true,
			finalScore: contentScore,
			cfContribution: null
		};
	});
}

function jaccard(a: number[], b: number[]): number {
	if (a.length === 0 || b.length === 0) return 0;
	const setA = new Set(a);
	const setB = new Set(b);
	let intersection = 0;
	for (const value of setA) if (setB.has(value)) intersection++;
	const unionSize = new Set([...setA, ...setB]).size;
	return unionSize === 0 ? 0 : intersection / unionSize;
}

/** Selección final tipo Maximal Marginal Relevance: prioriza relevancia pero penaliza
 * candidatos cuyo set de géneros se solapa demasiado con los ya elegidos (evita una lista de
 * 12 recomendaciones que son 12 variaciones del mismo subgénero). */
export function selectWithDiversity(
	scored: ScoredCandidate[],
	count: number,
	lambda = 0.7
): ScoredCandidate[] {
	const remaining = [...scored];
	const selected: ScoredCandidate[] = [];

	while (remaining.length > 0 && selected.length < count) {
		let bestIndex = 0;
		let bestValue = -Infinity;

		for (let i = 0; i < remaining.length; i++) {
			const candidate = remaining[i];
			const relevance = candidate.finalScore;
			const maxSimilarity = selected.reduce(
				(max, sel) => Math.max(max, jaccard(candidate.genreIds, sel.genreIds)),
				0
			);
			const value = lambda * relevance - (1 - lambda) * maxSimilarity;
			if (value > bestValue) {
				bestValue = value;
				bestIndex = i;
			}
		}

		selected.push(remaining[bestIndex]);
		remaining.splice(bestIndex, 1);
	}

	return selected;
}

/** Slots de exploración (estilo épsilon-greedy): mejores candidatos, por calidad, fuera de los
 * géneros dominantes del perfil — para no encerrar al usuario en su propia burbuja de gustos. */
export function selectExploration(
	pool: ScoredCandidate[],
	dominantGenreIds: Set<number>,
	count: number
): ScoredCandidate[] {
	const novel = pool.filter((candidate) => !candidate.genreIds.some((id) => dominantGenreIds.has(id)));
	return [...novel]
		.sort((a, b) => b.voteAverage - a.voteAverage || b.voteCount - a.voteCount)
		.slice(0, count);
}

interface Contribution {
	label: string;
	strength: number;
}

/** Las 2-3 señales que más contribuyeron al score, en texto legible. `candidate.cfContribution`
 * (0-1, o `null` si no se le aplicó CF) solo se menciona si superó un umbral — evita una razón
 * de relleno repetida en todos los ítems cuando el CF apenas influyó. */
export function buildReasons(candidate: ScoredCandidate): string[] {
	const { cfContribution } = candidate;
	const b = candidate.breakdown;
	const contributions: Contribution[] = [];

	if (b.topGenreName && b.genre > 0.55) {
		contributions.push({ label: `Por tu gusto en ${b.topGenreName}`, strength: b.genre });
	}
	const decade = decadeOf(candidate.releaseDate);
	if (decade !== null && b.decade > 0.6) {
		contributions.push({
			label: `Coincide con una época que sueles ver (${decade}s)`,
			strength: b.decade
		});
	}
	if (b.country > 0.65) {
		contributions.push({ label: 'De un país que sueles ver', strength: b.country });
	}
	if (b.topCastName && b.cast > 0.55) {
		contributions.push({
			label: `Con ${b.topCastName}, que aparece en tus favoritos`,
			strength: b.cast
		});
	}
	if (b.topDirectorName && b.director > 0.55) {
		contributions.push({
			label: `De ${b.topDirectorName}, cuyo trabajo te gustó`,
			strength: b.director
		});
	}
	if (b.topKeywordName && b.keyword > 0.55) {
		contributions.push({
			label: `Sobre ${b.topKeywordName}, un tema que te interesó`,
			strength: b.keyword
		});
	}
	if (b.quality > 0.75) {
		contributions.push({
			label: `Muy bien calificada en TMDb (${candidate.voteAverage.toFixed(1)})`,
			strength: b.quality
		});
	}
	if (b.provenance > 0.4) {
		contributions.push({ label: 'Parecida a algo que calificaste muy bien', strength: b.provenance });
	}
	if (cfContribution !== null && cfContribution > 0.15) {
		contributions.push({
			label: 'Gente con gustos parecidos a los tuyos también la valoró bien',
			strength: 0.5 + cfContribution
		});
	}

	const top = contributions.sort((a, b) => b.strength - a.strength).slice(0, 3);
	return top.length > 0 ? top.map((c) => c.label) : ['Recomendado para vos'];
}
