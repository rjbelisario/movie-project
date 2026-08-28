<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { posterUrl } from '$lib/tmdb-image';
	import LibraryItemControls from '$lib/components/LibraryItemControls.svelte';
	import EpisodeTracker from '$lib/components/EpisodeTracker.svelte';
	import type { LibraryItem } from '$lib/server/db/schema';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const details = $derived(data.details);
	const poster = $derived(posterUrl(details.posterPath, 'w342'));
	const backdrop = $derived(posterUrl(details.backdropPath, 'w780'));
	const year = $derived(details.releaseDate ? details.releaseDate.slice(0, 4) : null);

	const runtimeLabel = $derived.by(() => {
		if (details.mediaType === 'movie' && details.runtimeMinutes) {
			const hours = Math.floor(details.runtimeMinutes / 60);
			const minutes = details.runtimeMinutes % 60;
			return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
		}
		if (details.mediaType === 'tv' && details.numberOfSeasons) {
			const seasons = `${details.numberOfSeasons} temporada${details.numberOfSeasons === 1 ? '' : 's'}`;
			const episodes = details.numberOfEpisodes ? `, ${details.numberOfEpisodes} episodios` : '';
			return seasons + episodes;
		}
		return null;
	});

	let adding = $state(false);
	let addError = $state<string | null>(null);

	async function addToLibrary() {
		adding = true;
		addError = null;
		try {
			const response = await fetch('/api/library', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tmdbId: details.tmdbId,
					mediaType: details.mediaType,
					title: details.title,
					posterPath: details.posterPath,
					overview: details.overview,
					releaseDate: details.releaseDate,
					genres: details.genres,
					status: 'planned'
				})
			});
			if (!response.ok) throw new Error('No se pudo agregar.');
			await invalidateAll();
		} catch {
			addError = 'No se pudo agregar el título a la biblioteca.';
		} finally {
			adding = false;
		}
	}

	function handleUpdate(updated: LibraryItem) {
		data = { ...data, libraryItem: updated };
	}

	function handleDelete() {
		data = { ...data, libraryItem: undefined };
	}
</script>

<svelte:head><title>{details.title} — Mi Biblioteca</title></svelte:head>

<div class="-mx-4 -mt-6 mb-6 overflow-hidden sm:mx-0 sm:mt-0 sm:rounded-xl">
	<div class="relative h-48 w-full bg-shade-900 sm:h-64">
		{#if backdrop}
			<img src={backdrop} alt="" class="h-full w-full object-cover opacity-50" />
		{/if}
		<div
			class="absolute inset-0 bg-linear-to-t from-background via-background/50 to-transparent"
		></div>
		<div
			class="absolute inset-0 bg-linear-to-r from-background/80 via-transparent to-transparent"
		></div>
	</div>
</div>

<div class="flex flex-col gap-6 sm:flex-row">
	<div class="mx-auto w-40 shrink-0 sm:mx-0 sm:w-56">
		<div class="aspect-2/3 overflow-hidden rounded-lg bg-shade-800 shadow-lg">
			{#if poster}
				<img src={poster} alt={details.title} class="h-full w-full object-cover" />
			{:else}
				<div class="flex h-full items-center justify-center text-center text-sm text-text-secondary">
					Sin póster
				</div>
			{/if}
		</div>
	</div>

	<div class="flex-1">
		<h1 class="text-2xl font-bold text-text-primary">{details.title}</h1>
		{#if details.tagline}
			<p class="mt-1 text-sm text-text-secondary italic">{details.tagline}</p>
		{/if}

		<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-text-secondary">
			<span class="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-text-primary">
				{details.mediaType === 'movie' ? 'Película' : 'Serie'}
			</span>
			{#if year}<span>{year}</span>{/if}
			{#if runtimeLabel}<span>{runtimeLabel}</span>{/if}
			{#if details.voteAverage > 0}
				<span
					class="flex h-9 w-9 items-center justify-center rounded-full bg-purple-500 text-xs font-bold text-purple-50"
					title="Rating TMDb"
				>
					{details.voteAverage.toFixed(1)}
				</span>
			{/if}
		</div>

		{#if details.genres.length > 0}
			<div class="mt-3 flex flex-wrap gap-2">
				{#each details.genres as genre (genre)}
					<span class="rounded-full bg-surface px-3 py-1 text-xs text-text-secondary">
						{genre}
					</span>
				{/each}
			</div>
		{/if}

		<p class="mt-4 max-w-2xl text-text-secondary">
			{details.overview || 'Sin sinopsis disponible.'}
		</p>

		<div class="mt-6 max-w-xs">
			{#if data.libraryItem}
				<h2 class="mb-2 text-sm font-semibold text-text-secondary">En tu biblioteca</h2>
				<LibraryItemControls item={data.libraryItem} onUpdate={handleUpdate} onDelete={handleDelete} />
			{:else}
				<button
					onclick={addToLibrary}
					disabled={adding}
					class="rounded-lg bg-purple-600 px-4 py-2 font-medium text-purple-50 transition hover:bg-purple-700 disabled:opacity-50"
				>
					{adding ? 'Agregando…' : '+ Agregar a mi biblioteca'}
				</button>
				{#if addError}
					<p class="mt-2 text-sm text-red-400">{addError}</p>
				{/if}
			{/if}
		</div>
	</div>
</div>

{#if details.mediaType === 'tv' && details.seasons.length > 0}
	<section class="mt-8">
		<h2 class="mb-3 text-lg font-semibold text-text-primary">Episodios</h2>
		{#key details.tmdbId}
			<EpisodeTracker
				tvId={details.tmdbId}
				seasons={details.seasons}
				libraryItemId={data.libraryItem?.id}
				initialWatched={data.watchedEpisodes}
			/>
		{/key}
	</section>
{/if}
