import { Worker } from 'node:worker_threads';
import {
	buildModelFromParameters,
	type MatrixFactorizationModel,
	type TrainedParameters,
	type TrainOptions
} from '$lib/server/matrixFactorization';

/**
 * Entrena el modelo de factorización matricial en un worker thread separado, para no bloquear
 * el event loop del proceso principal — con el dataset completo de MovieLens (~34 millones de
 * ratings) el entrenamiento tarda ~1 minuto de CPU pura, y sin esto esos 60s dejarían la app
 * entera sin responder a nadie más (Node es single-threaded para JS).
 *
 * Los tres arrays de entrada se transfieren (no se copian) al worker vía `transferList`: quedan
 * inutilizables en este thread después de llamar a esta función, pero para este uso (entrenar y
 * listo) eso es exactamente lo que se quiere — evita duplicar ~400MB en memoria.
 */
export function trainMatrixFactorizationInWorker(
	userIndices: Int32Array,
	itemIndices: Int32Array,
	values: Float32Array,
	options: TrainOptions
): Promise<MatrixFactorizationModel> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL('./cfWorker.ts', import.meta.url), {
			workerData: { userIndices, itemIndices, values, options },
			transferList: [userIndices.buffer, itemIndices.buffer, values.buffer] as ArrayBuffer[]
		});

		worker.once('message', (params: TrainedParameters) => {
			resolve(buildModelFromParameters(params));
			void worker.terminate();
		});
		worker.once('error', (err) => {
			reject(err);
			void worker.terminate();
		});
	});
}
