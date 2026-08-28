<script lang="ts">
	import { onMount } from 'svelte';
	import { posterUrl } from '$lib/tmdb-image';
	import type { TmdbSeasonSummary, TmdbEpisode } from '$lib/server/tmdb';

	interface Props {
		tvId: number;
		seasons: TmdbSeasonSummary[];
		libraryItemId: number | undefined;
		initialWatched: { seasonNumber: number; episodeNumber: number }[];
	}

	let { tvId, seasons, libraryItemId, initialWatched }: Props = $props();

	function keyOf(seasonNumber: number, episodeNumber: number): string {
		return `${seasonNumber}-${episodeNumber}`;
	}

	// svelte-ignore state_referenced_locally -- snapshot inicial intencional, no un valor derivado
	let watchedKeys = $state(
		new Set(initialWatched.map((e) => keyOf(e.seasonNumber, e.episodeNumber)))
	);
	let pendingKeys = $state(new Set<string>());

	// svelte-ignore state_referenced_locally -- snapshot inicial intencional, no un valor derivado
	let selectedSeason = $state(seasons[0]?.seasonNumber ?? 1);
	let episodesBySeason = $state(new Map<number, TmdbEpisode[]>());
	let loadingSeason = $state(false);

	const totalEpisodes = $derived(seasons.reduce((sum, s) => sum + s.episodeCount, 0));
	const watchedCount = $derived(watchedKeys.size);
	const progressPct = $derived(totalEpisodes > 0 ? (watchedCount / totalEpisodes) * 100 : 0);
	const currentEpisodes = $derived(episodesBySeason.get(selectedSeason) ?? []);

	async function loadSeason(seasonNumber: number) {
		if (episodesBySeason.has(seasonNumber)) return;
		loadingSeason = true;
		try {
			const response = await fetch(`/api/tmdb/tv/${tvId}/season/${seasonNumber}`);
			if (!response.ok) return;
			const data = await response.json();
			episodesBySeason = new Map(episodesBySeason).set(seasonNumber, data.episodes);
		} finally {
			loadingSeason = false;
		}
	}

	function selectSeason(seasonNumber: number) {
		selectedSeason = seasonNumber;
		loadSeason(seasonNumber);
	}

	async function toggleEpisode(episode: TmdbEpisode) {
		if (!libraryItemId) return;
		const key = keyOf(episode.seasonNumber, episode.episodeNumber);
		if (pendingKeys.has(key)) return;

		const isWatched = watchedKeys.has(key);
		pendingKeys = new Set(pendingKeys).add(key);
		try {
			const response = await fetch(
				`/api/library/${libraryItemId}/episodes/${episode.seasonNumber}/${episode.episodeNumber}`,
				{ method: isWatched ? 'DELETE' : 'PUT' }
			);
			if (!response.ok) return;
			const next = new Set(watchedKeys);
			if (isWatched) next.delete(key);
			else next.add(key);
			watchedKeys = next;
		} finally {
			const next = new Set(pendingKeys);
			next.delete(key);
			pendingKeys = next;
		}
	}

	onMount(() => {
		// svelte-ignore state_referenced_locally -- carga inicial deliberada de la temporada por defecto
		loadSeason(selectedSeason);
	});
</script>

<div>
	{#if totalEpisodes > 0}
		<div class="mb-4 flex items-center gap-3">
			<div class="h-2 flex-1 max-w-xs rounded-full bg-surface">
				<div class="h-2 rounded-full bg-purple-500" style="width: {progressPct}%"></div>
			</div>
			<span class="text-sm text-text-secondary">{watchedCount} / {totalEpisodes} episodios</span>
		</div>
	{/if}

	{#if !libraryItemId}
		<p class="mb-4 text-sm text-text-secondary">
			Agrega esta serie a tu biblioteca para marcar episodios como vistos.
		</p>
	{/if}

	<div class="scroll-row mb-4 flex gap-2 overflow-x-auto pb-1">
		{#each seasons as season (season.seasonNumber)}
			<button
				onclick={() => selectSeason(season.seasonNumber)}
				class="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors {selectedSeason ===
				season.seasonNumber
					? 'bg-purple-500 text-purple-50'
					: 'bg-surface text-text-secondary hover:bg-surface-hover'}"
			>
				{season.name}
			</button>
		{/each}
	</div>

	{#if currentEpisodes.length === 0}
		<p class="text-sm text-text-secondary">Cargando episodios…</p>
	{:else}
		<div class="flex flex-col gap-2">
			{#each currentEpisodes as episode (keyOf(episode.seasonNumber, episode.episodeNumber))}
				{@const key = keyOf(episode.seasonNumber, episode.episodeNumber)}
				{@const watched = watchedKeys.has(key)}
				<div
					class="flex gap-3 rounded-lg border p-2 transition-colors {watched
						? 'border-purple-500/40 bg-purple-950/30'
						: 'border-border bg-surface'}"
				>
					<div class="aspect-video w-28 shrink-0 overflow-hidden rounded bg-shade-800">
						{#if posterUrl(episode.stillPath, 'w185')}
							<img
								src={posterUrl(episode.stillPath, 'w185')}
								alt={episode.name}
								class="h-full w-full object-cover"
								loading="lazy"
							/>
						{/if}
					</div>

					<div class="min-w-0 flex-1">
						<div class="flex items-start justify-between gap-2">
							<p class="text-sm font-medium text-text-primary">
								{episode.episodeNumber}. {episode.name}
							</p>
							{#if episode.airDate}
								<span class="shrink-0 text-xs text-text-secondary">{episode.airDate}</span>
							{/if}
						</div>
						<p class="mt-1 line-clamp-2 text-xs text-text-secondary">
							{episode.overview || 'Sin sinopsis.'}
						</p>
					</div>

					<button
						onclick={() => toggleEpisode(episode)}
						disabled={!libraryItemId || pendingKeys.has(key)}
						class="my-auto shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 {watched
							? 'bg-purple-500 text-purple-50 hover:bg-purple-600'
							: 'bg-surface-hover text-text-primary hover:bg-purple-600 hover:text-purple-50'}"
					>
						{watched ? '✓ Visto' : 'Marcar visto'}
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>
