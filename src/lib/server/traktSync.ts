import {
	getWatchedMovies,
	getWatchedShows,
	getWatchlistMovies,
	getWatchlistShows,
	type TraktWatchedShow
} from './trakt';
import { getValidAccessToken, markTraktSynced } from './traktAccount';
import { getMediaDetails } from './tmdb';
import {
	findLibraryItemByTmdb,
	addToLibrary,
	updateLibraryItem,
	markEpisodeWatched
} from './library';
import type { LibraryItem } from './db/schema';

/**
 * Importa el historial de Trakt (visto + pendientes) a la biblioteca local de `userId`.
 *
 * Reglas de importación (Trakt manda, pero nunca de forma destructiva):
 * - Un título visto en Trakt pasa a `completed` en la app, incluso si ya existía como `planned`.
 * - Un título en la watchlist de Trakt se crea como `planned` solo si todavía no existe local
 *   (si ya está `completed` localmente, no se degrada).
 * - Rating y notas propias de la app nunca se tocan: Trakt no los conoce.
 * - Para series, además se marca cada episodio visto individualmente en `episode_progress`,
 *   usando el tracker por episodio que ya tiene la app.
 */

export interface TraktSyncSummary {
	moviesWatched: number;
	showsWatched: number;
	episodesMarked: number;
	watchlistAdded: number;
	skipped: number;
}

async function ensureLibraryItem(
	userId: string,
	tmdbId: number,
	mediaType: LibraryItem['mediaType'],
	status: LibraryItem['status']
): Promise<{ item: LibraryItem; created: boolean } | null> {
	const existing = await findLibraryItemByTmdb(userId, tmdbId, mediaType);
	if (existing) {
		if (status === 'completed' && existing.status !== 'completed') {
			const updated = await updateLibraryItem(userId, existing.id, { status: 'completed' });
			return { item: updated ?? existing, created: false };
		}
		return { item: existing, created: false };
	}

	try {
		const details = await getMediaDetails(mediaType, tmdbId);
		const created = await addToLibrary(userId, {
			tmdbId,
			mediaType,
			title: details.title,
			posterPath: details.posterPath,
			overview: details.overview,
			releaseDate: details.releaseDate,
			genres: details.genres,
			status,
			rating: null,
			notes: null
		});
		return { item: created, created: true };
	} catch {
		return null;
	}
}

async function importWatchedShow(userId: string, watched: TraktWatchedShow, summary: TraktSyncSummary) {
	const tmdbId = watched.show.ids.tmdb;
	if (!tmdbId) {
		summary.skipped++;
		return;
	}

	const result = await ensureLibraryItem(userId, tmdbId, 'tv', 'completed');
	if (!result) {
		summary.skipped++;
		return;
	}
	summary.showsWatched++;

	for (const season of watched.seasons) {
		if (season.number === 0) continue; // especiales, igual que el resto de la app
		for (const episode of season.episodes) {
			await markEpisodeWatched(userId, result.item.id, season.number, episode.number);
			summary.episodesMarked++;
		}
	}
}

export async function syncTraktLibrary(userId: string): Promise<TraktSyncSummary> {
	const accessToken = await getValidAccessToken(userId);

	const [watchedMovies, watchedShows, watchlistMovies, watchlistShows] = await Promise.all([
		getWatchedMovies(accessToken),
		getWatchedShows(accessToken),
		getWatchlistMovies(accessToken),
		getWatchlistShows(accessToken)
	]);

	const summary: TraktSyncSummary = {
		moviesWatched: 0,
		showsWatched: 0,
		episodesMarked: 0,
		watchlistAdded: 0,
		skipped: 0
	};

	for (const watched of watchedMovies) {
		const tmdbId = watched.movie.ids.tmdb;
		if (!tmdbId) {
			summary.skipped++;
			continue;
		}
		const result = await ensureLibraryItem(userId, tmdbId, 'movie', 'completed');
		if (!result) {
			summary.skipped++;
			continue;
		}
		summary.moviesWatched++;
	}

	for (const watched of watchedShows) {
		await importWatchedShow(userId, watched, summary);
	}

	for (const entry of watchlistMovies) {
		const tmdbId = entry.movie.ids.tmdb;
		if (!tmdbId) {
			summary.skipped++;
			continue;
		}
		const result = await ensureLibraryItem(userId, tmdbId, 'movie', 'planned');
		if (!result) {
			summary.skipped++;
			continue;
		}
		if (result.created) summary.watchlistAdded++;
	}

	for (const entry of watchlistShows) {
		const tmdbId = entry.show.ids.tmdb;
		if (!tmdbId) {
			summary.skipped++;
			continue;
		}
		const result = await ensureLibraryItem(userId, tmdbId, 'tv', 'planned');
		if (!result) {
			summary.skipped++;
			continue;
		}
		if (result.created) summary.watchlistAdded++;
	}

	await markTraktSynced(userId);
	return summary;
}
