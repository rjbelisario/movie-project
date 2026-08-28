import type { TmdbMediaType } from '$lib/server/tmdb';

export function itemKey(mediaType: TmdbMediaType, tmdbId: number): string {
	return `${mediaType}:${tmdbId}`;
}

export interface GenreDirectory {
	nameToId: Map<string, number>;
	idToName: Map<number, string>;
}

export interface SeedItem {
	tmdbId: number;
	mediaType: TmdbMediaType;
	weight: number;
}

/** Perfil de gusto construido a partir de la biblioteca `completed` del usuario. Cada mapa de
 * afinidad puede tener valores negativos (géneros/personas de títulos que calificó mal). */
export interface TasteProfile {
	hasContentProfile: boolean;
	genreScores: Map<number, number>;
	decadeScores: Map<number, number>;
	countryScores: Map<string, number>;
	castScores: Map<number, number>;
	castNames: Map<number, string>;
	directorScores: Map<string, number>;
	keywordScores: Map<number, number>;
	keywordNames: Map<number, string>;
	/** Top 5 items mejor pesados, usados como semillas de `similar`/`recommendations`. */
	seedItems: SeedItem[];
}

/** Candidato crudo, antes de puntuar. */
export interface Candidate {
	tmdbId: number;
	mediaType: TmdbMediaType;
	title: string;
	overview: string;
	posterPath: string | null;
	releaseDate: string | null;
	genreIds: number[];
	voteAverage: number;
	voteCount: number;
	popularity: number;
	originalLanguage: string;
	originCountry: string[];
	/** Peso (sin normalizar) del seed del que salió vía similar/recommendations; 0 si vino de discover. */
	provenanceWeight: number;
}

export interface ScoreBreakdown {
	genre: number;
	decade: number;
	country: number;
	cast: number;
	director: number;
	keyword: number;
	quality: number;
	provenance: number;
	/** Mejores entidades que matchearon, para armar `reasons` legibles. */
	topGenreName: string | null;
	topCastName: string | null;
	topDirectorName: string | null;
	topKeywordName: string | null;
}

export interface ScoredCandidate extends Candidate {
	breakdown: ScoreBreakdown;
	contentScore: number;
	/** true si ya pasó por el fine re-rank (país/reparto/director/keywords reales, no neutros). */
	enriched: boolean;
	/** Score usado para rankear/seleccionar: igual a `contentScore` hasta que se mezcla con CF. */
	finalScore: number;
	/** Peso (0-1) con el que el collaborative filtering influyó en `finalScore`, o `null` si no se le aplicó CF. */
	cfContribution: number | null;
}

export interface RecommendedItem {
	tmdbId: number;
	mediaType: TmdbMediaType;
	title: string;
	overview: string;
	posterPath: string | null;
	releaseDate: string | null;
	genres: string[];
	reasons: string[];
}
