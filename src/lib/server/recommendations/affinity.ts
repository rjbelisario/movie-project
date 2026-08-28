/**
 * Utilidades para acumular y consultar mapas de afinidad con signo (positivo = le gustó,
 * negativo = lo calificó mal). `matchScore` centra el resultado en 0.5 (neutral/desconocido)
 * y lo acerca a 1 o 0 según qué tan fuerte sea la señal positiva o negativa relativa a los
 * extremos del propio perfil — así un valor nunca visto no penaliza ni beneficia al candidato.
 */

export function addAffinity<K>(map: Map<K, number>, key: K, weight: number): void {
	map.set(key, (map.get(key) ?? 0) + weight);
}

export interface AffinityBounds {
	maxPositive: number;
	minNegative: number;
}

export function affinityBounds<K>(map: Map<K, number>): AffinityBounds {
	let maxPositive = 0;
	let minNegative = 0;
	for (const value of map.values()) {
		if (value > maxPositive) maxPositive = value;
		if (value < minNegative) minNegative = value;
	}
	return { maxPositive, minNegative };
}

export function matchScore<K>(map: Map<K, number>, bounds: AffinityBounds, key: K): number {
	const raw = map.get(key);
	if (raw === undefined || raw === 0) return 0.5;
	if (raw > 0) return bounds.maxPositive > 0 ? 0.5 + 0.5 * (raw / bounds.maxPositive) : 0.5;
	return bounds.minNegative < 0 ? 0.5 - 0.5 * (raw / bounds.minNegative) : 0.5;
}

/** Promedio de `matchScore` sobre varias keys de un mismo candidato (ej. sus varios géneros). */
export function averageMatchScore<K>(map: Map<K, number>, bounds: AffinityBounds, keys: K[]): number {
	if (keys.length === 0) return 0.5;
	const sum = keys.reduce((acc, key) => acc + matchScore(map, bounds, key), 0);
	return sum / keys.length;
}

/** Las `limit` keys con mayor afinidad positiva del perfil, de mayor a menor. */
export function topPositiveKeys<K>(map: Map<K, number>, limit: number): K[] {
	return [...map.entries()]
		.filter(([, score]) => score > 0)
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([key]) => key);
}

/** La key con mayor afinidad positiva entre las del candidato, o `null` si ninguna tiene señal. */
export function bestMatchingKey<K>(map: Map<K, number>, keys: K[]): K | null {
	let best: K | null = null;
	let bestScore = 0;
	for (const key of keys) {
		const score = map.get(key) ?? 0;
		if (score > bestScore) {
			bestScore = score;
			best = key;
		}
	}
	return best;
}
