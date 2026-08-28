#!/usr/bin/env node
/**
 * Descarga el dataset "ml-latest" de GroupLens/MovieLens (continuamente actualizado — a
 * diferencia de "ml-latest-small", que quedó congelado en 2018) y lo procesa a un formato
 * binario compacto que usa `src/lib/server/recommendations/movieLensSeed.ts` para arrancar en
 * frío el collaborative filtering.
 *
 * No se commitea el resultado (es ~400MB, ver .gitignore) — correr este script una vez
 * localmente antes de levantar la app si querés el dataset completo. Si no lo corrés, el motor
 * de recomendaciones cae automáticamente al dataset chico bundleado (ml-latest-small, 1.3MB).
 *
 * Uso: node scripts/fetch-movielens.mjs
 */
import { createReadStream, createWriteStream, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATASET_URL = 'https://files.grouplens.org/datasets/movielens/ml-latest.zip';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'data', 'movielens-latest');
const tmpDir = path.join(projectRoot, '.tmp-movielens');
const zipPath = path.join(tmpDir, 'ml-latest.zip');

async function download() {
	console.log(`Descargando ${DATASET_URL} ...`);
	const response = await fetch(DATASET_URL);
	if (!response.ok) throw new Error(`Descarga falló: HTTP ${response.status}`);
	mkdirSync(tmpDir, { recursive: true });
	await pipeline(response.body, createWriteStream(zipPath));
	console.log('Descarga completa.');
}

function extract() {
	console.log('Extrayendo...');
	execSync(`unzip -o -q "${zipPath}" -d "${tmpDir}"`, { stdio: 'inherit' });
}

function parseLinks(linksPath) {
	const text = readFileSync(linksPath, 'utf-8').replace(/\r/g, '');
	const lines = text.split('\n');
	const movieIdToTmdbId = new Map();
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		const c1 = line.indexOf(',');
		const c2 = line.indexOf(',', c1 + 1);
		const movieId = line.slice(0, c1);
		const tmdbIdStr = line.slice(c2 + 1);
		if (tmdbIdStr.trim() !== '') movieIdToTmdbId.set(movieId, Number(tmdbIdStr));
	}
	return movieIdToTmdbId;
}

async function joinRatings(ratingsPath, movieIdToTmdbId) {
	// Cota superior generosa para no tener que hacer dos pasadas; se recorta al final con .subarray.
	const CAP = 40_000_000;
	const userIds = new Int32Array(CAP);
	const tmdbIds = new Int32Array(CAP);
	const ratings = new Float32Array(CAP);
	let count = 0;
	let lineNo = 0;

	const rl = createInterface({
		input: createReadStream(ratingsPath, { encoding: 'utf-8' }),
		crlfDelay: Infinity
	});
	for await (const line of rl) {
		lineNo++;
		if (lineNo === 1 || !line) continue;
		const c1 = line.indexOf(',');
		const c2 = line.indexOf(',', c1 + 1);
		const c3 = line.indexOf(',', c2 + 1);
		const movieId = line.slice(c1 + 1, c2);
		const tmdbId = movieIdToTmdbId.get(movieId);
		if (tmdbId === undefined) continue;
		userIds[count] = Number(line.slice(0, c1));
		tmdbIds[count] = tmdbId;
		ratings[count] = Number(line.slice(c2 + 1, c3));
		count++;
	}

	return {
		userIds: userIds.subarray(0, count),
		tmdbIds: tmdbIds.subarray(0, count),
		ratings: ratings.subarray(0, count),
		count
	};
}

async function main() {
	if (!existsSync(zipPath)) {
		await download();
	} else {
		console.log('Zip ya descargado, reutilizando.');
	}
	extract();

	const extractedDir = path.join(tmpDir, 'ml-latest');
	const movieIdToTmdbId = parseLinks(path.join(extractedDir, 'links.csv'));
	console.log(`links.csv: ${movieIdToTmdbId.size} películas con tmdbId.`);

	console.log('Uniendo ratings.csv con links.csv (puede tardar ~20-30s)...');
	const { userIds, tmdbIds, ratings, count } = await joinRatings(
		path.join(extractedDir, 'ratings.csv'),
		movieIdToTmdbId
	);
	console.log(`Ratings unidas: ${count}.`);

	mkdirSync(outDir, { recursive: true });
	writeFileSync(path.join(outDir, 'userIds.bin'), Buffer.from(userIds.buffer, userIds.byteOffset, userIds.byteLength));
	writeFileSync(path.join(outDir, 'tmdbIds.bin'), Buffer.from(tmdbIds.buffer, tmdbIds.byteOffset, tmdbIds.byteLength));
	writeFileSync(path.join(outDir, 'ratings.bin'), Buffer.from(ratings.buffer, ratings.byteOffset, ratings.byteLength));
	writeFileSync(path.join(outDir, 'count.txt'), String(count));
	console.log(`Escrito en ${outDir} (${(count * 12) / 1024 / 1024 | 0} MB).`);

	rmSync(tmpDir, { recursive: true, force: true });
	console.log('Listo. El motor de recomendaciones va a usar este dataset automáticamente.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
