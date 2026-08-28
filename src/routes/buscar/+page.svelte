<script lang="ts">
	import CardGrid from '$lib/components/CardGrid.svelte';
	import type { CardItem } from '$lib/types';

	let query = $state('');
	let results = $state<CardItem[]>([]);
	let loading = $state(false);
	let searched = $state(false);
	let addedTmdbIds = $state(new Set<number>());
	let addingTmdbId = $state<number | null>(null);
	let errorMessage = $state<string | null>(null);

	async function runSearch(event: SubmitEvent) {
		event.preventDefault();
		if (!query.trim()) return;

		loading = true;
		errorMessage = null;
		try {
			const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
			if (!response.ok) throw new Error('La búsqueda falló.');
			results = await response.json();
			searched = true;
		} catch {
			errorMessage = 'No se pudo buscar en TMDb. Verifica que TMDB_API_KEY esté configurada.';
		} finally {
			loading = false;
		}
	}

	async function addItem(item: CardItem) {
		addingTmdbId = item.tmdbId;
		try {
			const response = await fetch('/api/library', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tmdbId: item.tmdbId,
					mediaType: item.mediaType,
					title: item.title,
					posterPath: item.posterPath,
					overview: item.overview,
					releaseDate: item.releaseDate,
					genres: [],
					status: 'planned'
				})
			});
			if (!response.ok) throw new Error('No se pudo agregar.');
			addedTmdbIds = new Set(addedTmdbIds).add(item.tmdbId);
		} catch {
			errorMessage = 'No se pudo agregar el título a la biblioteca.';
		} finally {
			addingTmdbId = null;
		}
	}
</script>

<svelte:head><title>Buscar — Mi Biblioteca</title></svelte:head>

<h1 class="mb-4 text-xl font-semibold text-text-primary">Buscar películas y series</h1>

<form onsubmit={runSearch} class="mb-6 flex gap-2">
	<input
		type="search"
		bind:value={query}
		placeholder="Ej. Inception, Breaking Bad..."
		class="flex-1 rounded-lg border border-border bg-surface px-4 py-2 text-text-primary placeholder:text-text-secondary focus:ring-2 focus:ring-purple-500 focus:outline-none"
	/>
	<button
		type="submit"
		disabled={loading}
		class="rounded-lg bg-purple-600 px-4 py-2 font-medium text-purple-50 transition hover:bg-purple-700 disabled:opacity-50"
	>
		{loading ? 'Buscando…' : 'Buscar'}
	</button>
</form>

{#if errorMessage}
	<p class="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-400">{errorMessage}</p>
{/if}

{#if searched}
	<CardGrid items={results} emptyMessage="Sin resultados para esa búsqueda.">
		{#snippet actions(item: CardItem)}
			{#if addedTmdbIds.has(item.tmdbId)}
				<span
					class="block w-full rounded bg-green-700/40 py-1.5 text-center text-sm text-green-400"
				>
					✓ En biblioteca
				</span>
			{:else}
				<button
					onclick={() => addItem(item)}
					disabled={addingTmdbId === item.tmdbId}
					class="w-full rounded bg-surface-hover py-1.5 text-sm font-medium text-text-primary transition hover:bg-purple-600 disabled:opacity-50"
				>
					{addingTmdbId === item.tmdbId ? 'Agregando…' : '+ Agregar'}
				</button>
			{/if}
		{/snippet}
	</CardGrid>
{:else}
	<p class="text-text-secondary">Escribe un título para buscar en TMDb.</p>
{/if}
