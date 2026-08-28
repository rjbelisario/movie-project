import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import seedDataSmall from './data/movielens-seed.json';

/**
 * Semilla de "arranque en frío" para el collaborative filtering: ratings reales de MovieLens
 * (GroupLens Research — https://grouplens.org/datasets/movielens/), ya unidos contra `links.csv`
 * para tener el `tmdbId` de cada película en vez del `movieId` propio de MovieLens.
 *
 * Dos fuentes posibles, resueltas en este orden:
 * 1. `data/movielens-latest/{userIds,tmdbIds,ratings}.bin` — el dataset "ml-latest" completo
 *    (~34 millones de ratings, actualizado continuamente por GroupLens), generado localmente
 *    con `pnpm run data:movielens` (ver `scripts/fetch-movielens.mjs`). No se commitea (~400MB).
 * 2. `data/movielens-seed.json` (bundleado, 1.3MB) — "ml-latest-small", ~100.823 ratings,
 *    congelado en 2018. Es el fallback si no se corrió el script de descarga.
 *
 * Se exponen como arrays paralelos (no como array de objetos) porque a la escala del dataset
 * completo, 34 millones de objetos `{userId,tmdbId,rating}` serían un costo de memoria real e
 * innecesario — `collaborativeFiltering.ts` itera estos arrays directamente.
 *
 * Uso bajo licencia de investigación de GroupLens — no se re-expone ni redistribuye el dataset,
 * solo se usa para entrenar el modelo local. Atribución: F. Maxwell Harper y Joseph A. Konstan.
 * 2015. "The MovieLens Datasets: History and Context". ACM TiiS.
 *
 * Los userId de MovieLens son numéricos y nunca coinciden con los UUID de usuarios reales de la
 * app — igual se namespacean con el prefijo `ml:` al construir el índice del modelo (en
 * `collaborativeFiltering.ts`) para que quede explícito que son sintéticos y nunca reciban
 * recomendaciones ni cuenten para la confianza "el propio usuario ya calificó suficiente".
 */
export interface MovieLensSeed {
	/** userId numérico propio de MovieLens (sin prefijar todavía). */
	userIds: Int32Array;
	tmdbIds: Int32Array;
	ratings: Float32Array;
	count: number;
}

const HEAVY_DATA_DIR = join(process.cwd(), 'data', 'movielens-latest');

let cached: MovieLensSeed | null = null;

function loadHeavyDataset(): MovieLensSeed | null {
	const countPath = join(HEAVY_DATA_DIR, 'count.txt');
	if (!existsSync(countPath)) return null;

	const count = Number(readFileSync(countPath, 'utf-8').trim());
	const userIdsBuf = readFileSync(join(HEAVY_DATA_DIR, 'userIds.bin'));
	const tmdbIdsBuf = readFileSync(join(HEAVY_DATA_DIR, 'tmdbIds.bin'));
	const ratingsBuf = readFileSync(join(HEAVY_DATA_DIR, 'ratings.bin'));

	return {
		userIds: new Int32Array(userIdsBuf.buffer, userIdsBuf.byteOffset, count),
		tmdbIds: new Int32Array(tmdbIdsBuf.buffer, tmdbIdsBuf.byteOffset, count),
		ratings: new Float32Array(ratingsBuf.buffer, ratingsBuf.byteOffset, count),
		count
	};
}

function loadSmallDataset(): MovieLensSeed {
	const rows = seedDataSmall as [number, number, number][];
	const count = rows.length;
	const userIds = new Int32Array(count);
	const tmdbIds = new Int32Array(count);
	const ratings = new Float32Array(count);
	for (let i = 0; i < count; i++) {
		userIds[i] = rows[i][0];
		tmdbIds[i] = rows[i][1];
		ratings[i] = rows[i][2];
	}
	return { userIds, tmdbIds, ratings, count };
}

export function getMovieLensSeed(): MovieLensSeed {
	if (cached) return cached;
	cached = loadHeavyDataset() ?? loadSmallDataset();
	return cached;
}
