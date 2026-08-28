/**
 * Cache genérico en memoria de proceso con TTL. Usado para el resultado final de
 * recomendaciones por usuario, la metadata de TMDb compartida por título, y el modelo de
 * collaborative filtering entrenado. No persiste entre instancias serverless ni reinicios —
 * es una optimización de "no recomputar dentro de la misma instancia caliente", no una fuente
 * de verdad.
 */
export class TtlCache<T> {
	private readonly store = new Map<string, { value: T; expiresAt: number }>();

	constructor(private readonly ttlMs: number) {}

	get(key: string): T | undefined {
		const entry = this.store.get(key);
		if (!entry) return undefined;
		if (entry.expiresAt <= Date.now()) {
			this.store.delete(key);
			return undefined;
		}
		return entry.value;
	}

	set(key: string, value: T): void {
		this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
	}

	delete(key: string): void {
		this.store.delete(key);
	}

	/** Obtiene el valor cacheado o lo calcula, cachea y devuelve. Evita el patrón get/compute/set repetido. */
	async getOrCompute(key: string, compute: () => Promise<T>): Promise<T> {
		const cached = this.get(key);
		if (cached !== undefined) return cached;
		const value = await compute();
		this.set(key, value);
		return value;
	}
}
