import { parentPort, workerData } from 'node:worker_threads';
import { trainMatrixFactorizationRaw, type TrainOptions } from '../matrixFactorization.ts';

/**
 * Entry point del worker thread que entrena el collaborative filtering. Vive en su propio
 * archivo (no una función exportada más) porque `worker_threads` necesita un módulo real para
 * cargar en el thread nuevo — no se puede simplemente pasarle una función.
 *
 * Import relativo con extensión `.ts` explícita a propósito: este archivo lo carga el runtime
 * de Node directamente (soporte nativo de TypeScript, sin paso por Vite), no el resolver de
 * SvelteKit — el alias `$lib` no existe acá.
 */
interface CfWorkerInput {
	userIndices: Int32Array;
	itemIndices: Int32Array;
	values: Float32Array;
	options: TrainOptions;
}

const { userIndices, itemIndices, values, options } = workerData as CfWorkerInput;

const params = trainMatrixFactorizationRaw(userIndices, itemIndices, values, options);

parentPort!.postMessage(params, [
	params.userBias.buffer,
	params.itemBias.buffer,
	params.userFactors.buffer,
	params.itemFactors.buffer
] as ArrayBuffer[]);
