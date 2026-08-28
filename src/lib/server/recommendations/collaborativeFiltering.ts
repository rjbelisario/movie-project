import { isNotNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { libraryItems } from '$lib/server/db/schema';
import type { MatrixFactorizationModel } from '$lib/server/matrixFactorization';
import { TtlCache } from './cache';
import { trainMatrixFactorizationInWorker } from './cfTrainingWorker';
import { getMovieLensSeed } from './movieLensSeed';
import { itemKey } from './types';

const MOVIELENS_USER_PREFIX = 'ml:';

const CF_MODEL_TTL_MS = 45 * 60 * 1000;
const CF_MODEL_CACHE_KEY = 'global';
const cfModelCache = new TtlCache<CfContext | null>(CF_MODEL_TTL_MS);

/** Techo de cuánto puede pesar el CF en el score final, aunque haya muchísimos datos. */
const CF_WEIGHT_CEILING = 0.4;
/** Cantidad de ítems con 2+ calificadores distintos (biblioteca local + semilla MovieLens) a
 * partir de la cual el CF "global" alcanza su peso máximo (escala linealmente hasta acá). Con
 * la semilla de MovieLens cargada, esto se satisface desde el primer momento — es justamente
 * lo que resuelve el cold-start de "necesitamos muchos usuarios reales antes de que el CF sirva". */
const CF_GLOBAL_CONFIDENCE_TARGET = 30;
/** Ratings del propio usuario (solo biblioteca local, MovieLens no cuenta acá) a partir de los
 * cuales se confía del todo en su vector latente. */
const CF_USER_CONFIDENCE_TARGET = 5;
/** Salvaguarda trivial: si ni siquiera hay esta cantidad de ratings combinados, no vale la pena
 * entrenar. En la práctica la semilla de MovieLens por sí sola la supera ampliamente. */
const MIN_TOTAL_RATINGS_TO_TRAIN = 10;

export interface CfContext {
	model: MatrixFactorizationModel;
	userIndex: Map<string, number>;
	itemIndex: Map<string, number>;
	itemsWithMultipleRaters: number;
	userRatingCounts: Map<string, number>;
}

/**
 * Única función del proyecto que lee `library_items.rating` de TODOS los usuarios a la vez
 * (sin filtrar por `userId`). Es una excepción intencional y documentada al invariante de
 * `library.ts` ("todo se filtra por userId") — el propósito del collaborative filtering es
 * justamente cruzar gustos entre usuarios. Selecciona solo las columnas necesarias, nunca el
 * resto de la fila (notas, overview, etc. de otro usuario no tienen por qué transitar por acá).
 */
async function getAllRatingsForCfTraining(): Promise<
	{ userId: string; tmdbId: number; mediaType: 'movie' | 'tv'; rating: number }[]
> {
	const rows = await db
		.select({
			userId: libraryItems.userId,
			tmdbId: libraryItems.tmdbId,
			mediaType: libraryItems.mediaType,
			rating: libraryItems.rating
		})
		.from(libraryItems)
		.where(isNotNull(libraryItems.rating));

	return rows.map((row) => ({ ...row, rating: row.rating as number }));
}

async function buildCfContext(): Promise<CfContext | null> {
	const localRatings = await getAllRatingsForCfTraining();
	const movieLens = getMovieLensSeed();
	const totalCount = localRatings.length + movieLens.count;

	if (totalCount < MIN_TOTAL_RATINGS_TO_TRAIN) return null;

	const userIndex = new Map<string, number>();
	const itemIndex = new Map<string, number>();
	// Conteo de ratings por ítem, no de raters distintos: reconstruir un Set<string> de userIds
	// por cada uno de los ~86.000 ítems sobre ~34 millones de filas sería carísimo en memoria.
	// Es una aproximación válida porque tanto MovieLens como `library_items` garantizan como
	// mucho un rating por (usuario, ítem) — cada fila ya es, por construcción, un rater distinto.
	const itemRatingCounts = new Map<string, number>();
	// Solo ratings LOCALES: la confianza "el propio usuario ya calificó suficiente" no debe
	// inflarse por la semilla de MovieLens, que no es del usuario.
	const userRatingCounts = new Map<string, number>();

	// Arrays paralelos preasignados (no un array de objetos) — a 34 millones de filas, ese es
	// el mismo motivo por el que `matrixFactorization.ts` recibe typed arrays en vez de `Rating[]`.
	const userIdxArr = new Int32Array(totalCount);
	const itemIdxArr = new Int32Array(totalCount);
	const ratingArr = new Float32Array(totalCount);
	let cursor = 0;

	for (const rating of localRatings) {
		userRatingCounts.set(rating.userId, (userRatingCounts.get(rating.userId) ?? 0) + 1);

		let u = userIndex.get(rating.userId);
		if (u === undefined) {
			u = userIndex.size;
			userIndex.set(rating.userId, u);
		}

		const key = itemKey(rating.mediaType, rating.tmdbId);
		let it = itemIndex.get(key);
		if (it === undefined) {
			it = itemIndex.size;
			itemIndex.set(key, it);
		}
		itemRatingCounts.set(key, (itemRatingCounts.get(key) ?? 0) + 1);

		userIdxArr[cursor] = u;
		itemIdxArr[cursor] = it;
		ratingArr[cursor] = rating.rating;
		cursor++;
	}

	// MovieLens es solo películas — sus tmdbId nunca colisionan con series porque itemKey
	// incluye el mediaType.
	//
	// A esta escala (~34 millones de filas), reconstruir la clave string `ml:${userId}` y
	// buscarla en un Map<string,...> **por cada fila** es el cuello de botella real (hashear y
	// comparar strings es mucho más caro que hashear números, y solo hay 330.975 usuarios y
	// ~86.000 películas distintas detrás de esas 34 millones de filas). Solución en dos pasos:
	// 1) indexar los ids NUMÉRICOS propios de MovieLens con Maps numéricos (rápido),
	// 2) traducir cada id distinto (no cada fila) a la clave unificada string una única vez.
	const mlUserDenseIndex = new Map<number, number>();
	const mlItemDenseIndex = new Map<number, number>();
	for (let i = 0; i < movieLens.count; i++) {
		const uid = movieLens.userIds[i];
		if (!mlUserDenseIndex.has(uid)) mlUserDenseIndex.set(uid, mlUserDenseIndex.size);
		const tid = movieLens.tmdbIds[i];
		if (!mlItemDenseIndex.has(tid)) mlItemDenseIndex.set(tid, mlItemDenseIndex.size);
	}

	const mlUserToUnified = new Int32Array(mlUserDenseIndex.size);
	for (const [uid, dense] of mlUserDenseIndex) {
		const key = `${MOVIELENS_USER_PREFIX}${uid}`;
		let u = userIndex.get(key);
		if (u === undefined) {
			u = userIndex.size;
			userIndex.set(key, u);
		}
		mlUserToUnified[dense] = u;
	}

	const mlItemToUnified = new Int32Array(mlItemDenseIndex.size);
	const mlItemRatingCounts = new Int32Array(mlItemDenseIndex.size);
	for (const [tid, dense] of mlItemDenseIndex) {
		const key = itemKey('movie', tid);
		let it = itemIndex.get(key);
		if (it === undefined) {
			it = itemIndex.size;
			itemIndex.set(key, it);
		}
		mlItemToUnified[dense] = it;
	}

	for (let i = 0; i < movieLens.count; i++) {
		const uDense = mlUserDenseIndex.get(movieLens.userIds[i])!;
		const iDense = mlItemDenseIndex.get(movieLens.tmdbIds[i])!;
		mlItemRatingCounts[iDense]++;

		userIdxArr[cursor] = mlUserToUnified[uDense];
		itemIdxArr[cursor] = mlItemToUnified[iDense];
		ratingArr[cursor] = movieLens.ratings[i];
		cursor++;
	}

	// Nota: si un ítem tiene, por ejemplo, 1 rating local + 1 de MovieLens, cada fuente lo ve
	// por separado como "1 solo rater" y no se suma entre fuentes — un caso borde raro (MovieLens
	// promedia ~cientos de raters por película) que no vale la pena resolver con más complejidad,
	// dado que esto solo alimenta un peso de confianza 0-1, no un valor que deba ser exacto.
	let itemsWithMultipleRaters = 0;
	for (const count of itemRatingCounts.values()) {
		if (count >= 2) itemsWithMultipleRaters++;
	}
	for (let dense = 0; dense < mlItemRatingCounts.length; dense++) {
		if (mlItemRatingCounts[dense] >= 2) itemsWithMultipleRaters++;
	}

	const model = await trainMatrixFactorizationInWorker(userIdxArr, itemIdxArr, ratingArr, {
		numUsers: userIndex.size,
		numItems: itemIndex.size,
		minRating: 0.5,
		maxRating: 5
	});

	return { model, userIndex, itemIndex, itemsWithMultipleRaters, userRatingCounts };
}

/** Modelo entrenado, cacheado a nivel de módulo — no se reentrena en cada request. */
export async function getCfContext(): Promise<CfContext | null> {
	return cfModelCache.getOrCompute(CF_MODEL_CACHE_KEY, buildCfContext);
}

export interface CfPrediction {
	/** Predicción de rating (1-5) para este usuario e ítem. */
	predictedRating: number;
	/** Peso final (0 a `CF_WEIGHT_CEILING`) con el que este ítem debe mezclarse con el content-based. */
	weight: number;
}

/**
 * Predicción híbrida-ready para un (usuario, ítem) puntual. Devuelve `null` si no hay modelo,
 * el ítem nunca fue calificado por nadie (CF no puede predecir nada nuevo), o el usuario nunca
 * calificó nada (no tiene vector latente entrenado).
 */
export function predictForUser(
	cf: CfContext | null,
	userId: string,
	mediaType: 'movie' | 'tv',
	tmdbId: number
): CfPrediction | null {
	if (!cf) return null;

	const userIdx = cf.userIndex.get(userId);
	const itemIdx = cf.itemIndex.get(itemKey(mediaType, tmdbId));
	if (userIdx === undefined || itemIdx === undefined) return null;

	const cfWeightGlobal = CF_WEIGHT_CEILING * Math.min(1, cf.itemsWithMultipleRaters / CF_GLOBAL_CONFIDENCE_TARGET);
	const userRatingCount = cf.userRatingCounts.get(userId) ?? 0;
	const cfWeightUser = Math.min(1, userRatingCount / CF_USER_CONFIDENCE_TARGET);
	const weight = cfWeightGlobal * cfWeightUser;

	if (weight <= 0) return null;

	return { predictedRating: cf.model.predict(userIdx, itemIdx), weight };
}

/** Normaliza una predicción (escala 0.5-5, la de MovieLens) a 0-1 por escala absoluta (no
 * min-max relativo al pool, que es frágil cuando el conjunto de candidatos es chico u homogéneo). */
export function normalizeCfScore(predictedRating: number): number {
	return (Math.min(5, Math.max(0.5, predictedRating)) - 0.5) / 4.5;
}
