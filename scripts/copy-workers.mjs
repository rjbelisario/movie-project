#!/usr/bin/env node
/**
 * Copia los archivos fuente que corren en un `worker_thread` (ver
 * `src/lib/server/recommendations/cfTrainingWorker.ts`) tal cual, sin pasar por el bundle de
 * Vite, a `build/workers/`.
 *
 * Por qué hace falta: Vite reconoce el patrón `new Worker(new URL('./x', import.meta.url))`
 * automáticamente solo para Web Workers del lado del cliente. Para `node:worker_threads` del
 * lado del servidor no hace nada especial — el archivo referenciado (`cfWorker.ts`) nunca se
 * copia al build de `adapter-node`, así que en producción `new URL(...)` apunta a un archivo
 * que no existe (`Cannot find module '.../chunks/cfWorker.ts'`). Node 24 puede ejecutar `.ts`
 * directamente (type-stripping nativo), así que la solución es copiar el `.ts` sin tocar, y
 * `cfTrainingWorker.ts` lo referencia desde `build/workers/` en producción (ver `dev` check ahí).
 *
 * Se corre automáticamente después de `vite build` (script `postbuild` en package.json).
 */
import { mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const outDir = path.join(projectRoot, 'build', 'workers');
mkdirSync(path.join(outDir, 'recommendations'), { recursive: true });

copyFileSync(
	path.join(projectRoot, 'src/lib/server/recommendations/cfWorker.ts'),
	path.join(outDir, 'recommendations/cfWorker.ts')
);
copyFileSync(
	path.join(projectRoot, 'src/lib/server/matrixFactorization.ts'),
	path.join(outDir, 'matrixFactorization.ts')
);

console.log('Worker files copiados a build/workers/');
