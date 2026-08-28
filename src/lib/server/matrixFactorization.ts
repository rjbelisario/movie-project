/**
 * Factorización matricial sesgada (FunkSVD) entrenada por SGD — el mismo enfoque que se usó
 * en el Netflix Prize. Genérica y sin conocimiento de dominio: recibe tripletas
 * (índice de usuario, índice de ítem, rating) y no sabe qué representan esos índices.
 *
 * La entrada son tres arrays paralelos (`ArrayLike<number>`, acepta tanto `number[]` como
 * `Int32Array`/`Float32Array`) en vez de un array de objetos `{userIndex, itemIndex, value}`:
 * a la escala del dataset de MovieLens completo (~34 millones de ratings), un array de objetos
 * supondría ~34 millones de allocations extra — los typed arrays evitan ese costo por completo.
 *
 * `trainMatrixFactorizationRaw` separa el cómputo (arrays planos, sin funciones) de
 * `buildModelFromParameters` (arma el closure `predict`) para poder correr el entrenamiento en
 * un worker thread (`collaborativeFiltering.ts` lo hace con el dataset completo de MovieLens):
 * un closure con una función adentro no se puede mandar de un thread a otro con `postMessage`,
 * pero los `Float64Array` sí (y encima se pueden transferir sin copiar).
 */

export interface MatrixFactorizationModel {
	/** Predicción para (userIndex, itemIndex), clampeada a [minRating, maxRating]. */
	predict(userIndex: number, itemIndex: number): number;
}

export interface TrainOptions {
	numUsers: number;
	numItems: number;
	epochs?: number;
	learningRate?: number;
	regBias?: number;
	regFactor?: number;
	/** Número de factores latentes. Si se omite, se deriva de la cantidad de ratings (ver `pickFactorCount`). */
	numFactors?: number;
	minRating?: number;
	maxRating?: number;
}

/** Parámetros ya entrenados — todo lo que hace falta para predecir, sin ninguna función adentro. */
export interface TrainedParameters {
	globalMean: number;
	userBias: Float64Array;
	itemBias: Float64Array;
	userFactors: Float64Array;
	itemFactors: Float64Array;
	numFactors: number;
	minRating: number;
	maxRating: number;
}

/**
 * Elige K adaptado al volumen de datos: con pocos ratings, muchos factores latentes
 * sobreajustan (cada factor termina memorizando el ruido de uno o dos ratings).
 */
export function pickFactorCount(totalRatings: number): number {
	return Math.min(6, Math.max(2, Math.floor(totalRatings / 20)));
}

/**
 * Elige la cantidad de épocas adaptada al volumen. Validado empíricamente (split 95/5,
 * midiendo % de predicciones a menos de 1 estrella del rating real) con los dos datasets de
 * MovieLens que soporta el proyecto:
 *
 * - ml-latest-small (~100K ratings, 610 usuarios): pico real en la época ~15 (79.2% de aciertos);
 *   de ahí en más EMPEORA por sobreajuste — época 50 cae a 78.7%, época 200 cae a 76.3% (peor
 *   que con muchas menos épocas). El techo de 200 que tenía este archivo antes de medir esto
 *   estaba, sin que nadie lo supiera, entrenando en zona de sobreajuste por defecto.
 * - ml-latest completo (~34M ratings, 331K usuarios): 80.0% en la época 3, 82.1% en la 15 —
 *   mejora real pero marginal, domina el volumen de datos, no las épocas.
 *
 * Por eso el techo baja de 200 a 20 (con margen sobre el pico medido de ~15) — más épocas que
 * eso no mejoran nada con ninguno de los dos tamaños de dataset, y con el chico activamente
 * empeoran el modelo.
 */
export function pickEpochCount(totalRatings: number): number {
	return Math.min(20, Math.max(3, Math.round(20_000_000 / totalRatings)));
}

function randomSmall(): number {
	return (Math.random() - 0.5) * 0.2;
}

export function trainMatrixFactorizationRaw(
	userIndices: ArrayLike<number>,
	itemIndices: ArrayLike<number>,
	values: ArrayLike<number>,
	options: TrainOptions
): TrainedParameters {
	const count = values.length;
	const {
		numUsers,
		numItems,
		epochs = pickEpochCount(count),
		learningRate = 0.01,
		regBias = 0.005,
		regFactor = 0.02,
		numFactors = pickFactorCount(count),
		minRating = 1,
		maxRating = 5
	} = options;

	let sum = 0;
	for (let i = 0; i < count; i++) sum += values[i];
	const globalMean = sum / count;

	const userBias = new Float64Array(numUsers);
	const itemBias = new Float64Array(numItems);
	const userFactors = new Float64Array(numUsers * numFactors);
	const itemFactors = new Float64Array(numItems * numFactors);
	for (let i = 0; i < userFactors.length; i++) userFactors[i] = randomSmall();
	for (let i = 0; i < itemFactors.length; i++) itemFactors[i] = randomSmall();

	const order = new Uint32Array(count);
	for (let i = 0; i < count; i++) order[i] = i;

	for (let epoch = 0; epoch < epochs; epoch++) {
		// Shuffle (Fisher-Yates) — el orden de presentación importa para SGD.
		for (let i = count - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const tmp = order[i];
			order[i] = order[j];
			order[j] = tmp;
		}

		for (let oi = 0; oi < count; oi++) {
			const row = order[oi];
			const u = userIndices[row];
			const it = itemIndices[row];
			const r = values[row];

			const uOff = u * numFactors;
			const iOff = it * numFactors;
			let dot = 0;
			for (let k = 0; k < numFactors; k++) dot += userFactors[uOff + k] * itemFactors[iOff + k];

			const pred = globalMean + userBias[u] + itemBias[it] + dot;
			const err = r - pred;

			userBias[u] += learningRate * (err - regBias * userBias[u]);
			itemBias[it] += learningRate * (err - regBias * itemBias[it]);

			for (let k = 0; k < numFactors; k++) {
				const uk = userFactors[uOff + k];
				const ik = itemFactors[iOff + k];
				userFactors[uOff + k] = uk + learningRate * (err * ik - regFactor * uk);
				itemFactors[iOff + k] = ik + learningRate * (err * uk - regFactor * ik);
			}
		}
	}

	return { globalMean, userBias, itemBias, userFactors, itemFactors, numFactors, minRating, maxRating };
}

export function buildModelFromParameters(params: TrainedParameters): MatrixFactorizationModel {
	const { globalMean, userBias, itemBias, userFactors, itemFactors, numFactors, minRating, maxRating } =
		params;

	return {
		predict(userIndex: number, itemIndex: number): number {
			const uOff = userIndex * numFactors;
			const iOff = itemIndex * numFactors;
			let dot = 0;
			for (let k = 0; k < numFactors; k++) dot += userFactors[uOff + k] * itemFactors[iOff + k];
			const pred = globalMean + userBias[userIndex] + itemBias[itemIndex] + dot;
			return Math.min(maxRating, Math.max(minRating, pred));
		}
	};
}

/** Conveniencia: entrena y arma el modelo en un solo paso, en el thread actual (bloqueante). */
export function trainMatrixFactorization(
	userIndices: ArrayLike<number>,
	itemIndices: ArrayLike<number>,
	values: ArrayLike<number>,
	options: TrainOptions
): MatrixFactorizationModel {
	return buildModelFromParameters(trainMatrixFactorizationRaw(userIndices, itemIndices, values, options));
}
