<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { posterUrl } from '$lib/tmdb-image';
	import LibraryItemControls from '$lib/components/LibraryItemControls.svelte';
	import EpisodeTracker from '$lib/components/EpisodeTracker.svelte';
	import CastList from '$lib/components/CastList.svelte';
	import CardRow from '$lib/components/CardRow.svelte';
	import type { LibraryItem } from '$lib/server/db/schema';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const details = $derived(data.details);
	const poster = $derived(posterUrl(details.posterPath, 'w342'));
	const backdrop = $derived(posterUrl(details.backdropPath, 'w1280'));
	const year = $derived(details.releaseDate ? details.releaseDate.slice(0, 4) : null);

	const creators = $derived(
		details.mediaType === 'movie' ? data.credits.directors : details.creators
	);
	const creatorsLabel = $derived(details.mediaType === 'movie' ? 'Dirigida por' : 'Creada por');

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

	const statusLabels: Record<NonNullable<LibraryItem['status']>, string> = {
		planned: 'Pendiente',
		completed: 'Completada'
	};

	const trailerUrl = $derived(
		data.trailerKey ? `https://www.youtube.com/watch?v=${data.trailerKey}` : null
	);

	let addingStatus = $state<LibraryItem['status'] | null>(null);
	let addError = $state<string | null>(null);

	async function addToLibrary(status: LibraryItem['status']) {
		addingStatus = status;
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
					status
				})
			});
			if (!response.ok) throw new Error('No se pudo agregar.');
			await invalidateAll();
		} catch {
			addError = 'No se pudo agregar el título a la biblioteca.';
		} finally {
			addingStatus = null;
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
	<div class="relative h-56 w-full bg-shade-900 sm:h-80">
		{#if backdrop}
			<img src={backdrop} alt="" class="h-full w-full object-cover opacity-60" />
		{/if}
		<div
			class="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent"
		></div>
		<div
			class="absolute inset-0 bg-linear-to-r from-background/90 via-background/10 to-transparent"
		></div>
	</div>
</div>

<div class="flex flex-col gap-6 sm:flex-row">
	<div class="mx-auto w-40 shrink-0 sm:mx-0 sm:-mt-24 sm:w-56">
		<div class="relative aspect-2/3 overflow-hidden rounded-lg bg-shade-800 shadow-2xl">
			{#if poster}
				<img src={poster} alt={details.title} class="h-full w-full object-cover" />
			{:else}
				<div class="flex h-full items-center justify-center text-center text-sm text-text-secondary">
					Sin póster
				</div>
			{/if}

			<span
				class="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-shade-10 uppercase"
			>
				{details.mediaType === 'movie' ? 'Película' : 'Serie'}
			</span>

			{#if data.libraryItem}
				<span
					class="absolute top-2 right-2 rounded-full bg-purple-500 px-2 py-0.5 text-[10px] font-semibold text-purple-50"
				>
					{statusLabels[data.libraryItem.status]}
				</span>
			{/if}
		</div>
	</div>

	<div class="flex-1">
		<h1 class="text-2xl font-bold text-text-primary sm:text-3xl">{details.title}</h1>
		{#if details.tagline}
			<p class="mt-1 text-sm text-text-secondary italic">{details.tagline}</p>
		{/if}
		{#if creators.length > 0}
			<p class="mt-1 text-sm text-text-secondary">{creatorsLabel} {creators.join(', ')}</p>
		{/if}

		<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-text-secondary">
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

		{#if data.genres.length > 0}
			<div class="mt-3 flex flex-wrap gap-2">
				{#each data.genres as genre (genre.name)}
					{#if genre.id !== null}
						<a
							href="/buscar?genre={genre.id}&mediaType={details.mediaType}&name={encodeURIComponent(
								genre.name
							)}"
							class="rounded-full bg-surface px-3 py-1 text-xs text-text-secondary transition-colors hover:bg-purple-500 hover:text-purple-50"
						>
							{genre.name}
						</a>
					{:else}
						<span class="rounded-full bg-surface px-3 py-1 text-xs text-text-secondary">
							{genre.name}
						</span>
					{/if}
				{/each}
			</div>
		{/if}

		<p class="mt-4 max-w-2xl text-text-secondary">
			{details.overview || 'Sin sinopsis disponible.'}
		</p>

		{#if data.libraryItem}
			<div class="mt-6 max-w-2xl rounded-xl border border-border bg-surface p-4">
				<div class="mb-3 flex items-center justify-between gap-3">
					<h2 class="text-sm font-semibold text-text-secondary">En tu biblioteca</h2>
					{#if trailerUrl}
						<a
							href={trailerUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="flex shrink-0 items-center gap-1.5 text-sm font-medium text-emphasis hover:underline"
						>
							▶ Tráiler
						</a>
					{/if}
				</div>
				<LibraryItemControls
					item={data.libraryItem}
					onUpdate={handleUpdate}
					onDelete={handleDelete}
					size="large"
				/>
			</div>
		{:else}
			<div class="mt-6 flex flex-wrap items-start gap-3">
				<div>
					<div class="flex flex-wrap gap-3">
						<button
							onclick={() => addToLibrary('completed')}
							disabled={addingStatus !== null}
							class="rounded-lg bg-purple-600 px-4 py-2 font-medium text-purple-50 transition hover:bg-purple-700 disabled:opacity-50"
						>
							{addingStatus === 'completed' ? 'Guardando…' : '✓ Marcar como vista'}
						</button>
						<button
							onclick={() => addToLibrary('planned')}
							disabled={addingStatus !== null}
							class="rounded-lg border border-border px-4 py-2 font-medium text-text-primary transition hover:bg-surface-hover disabled:opacity-50"
						>
							{addingStatus === 'planned' ? 'Guardando…' : '+ Agregar a watchlist'}
						</button>
					</div>
					{#if addError}
						<p class="mt-2 text-sm text-red-400">{addError}</p>
					{/if}
				</div>

				{#if trailerUrl}
					<a
						href={trailerUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 font-medium text-text-primary transition hover:bg-surface-hover"
					>
						▶ Tráiler
					</a>
				{/if}
			</div>
		{/if}
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

<div class="mt-8">
	<CastList cast={data.credits.cast} />
</div>

<CardRow title="Títulos similares" items={data.similar} />
