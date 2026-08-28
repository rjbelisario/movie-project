/**
 * Aplica `fn` a cada elemento de `items` con un límite global de operaciones en vuelo.
 * Usado para llamadas HTTP a TMDb: evita disparar decenas de fetches simultáneos que
 * puedan gatillar rate-limiting (429), sin perder el paralelismo dentro del límite.
 */
export async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let nextIndex = 0;

	async function worker(): Promise<void> {
		while (nextIndex < items.length) {
			const index = nextIndex++;
			results[index] = await fn(items[index], index);
		}
	}

	const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
	await Promise.all(workers);

	return results;
}
