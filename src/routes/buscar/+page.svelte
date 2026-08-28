<script lang="ts">
	import { page } from '$app/state';
	import CardGrid from '$lib/components/CardGrid.svelte';
	import type { CardItem } from '$lib/types';
	import type { TmdbSortBy } from '$lib/server/tmdb';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let query = $state('');
	let results = $state<CardItem[]>([]);
	let loading = $state(false);
	let searched = $state(false);
	let addedTmdbIds = $state(new Set<number>());
	let addingTmdbId = $state<number | null>(null);
	let errorMessage = $state<string | null>(null);

	const currentYear = new Date().getFullYear();
	const years = Array.from({ length: currentYear - 1949 }, (_, i) => currentYear - i);
	const sortOptions: { value: TmdbSortBy; label: string }[] = [
		{ value: 'popularity.desc', label: 'Popularidad' },
		{ value: 'vote_average.desc', label: 'Mejor calificados' },
		{ value: 'primary_release_date.desc', label: 'Más recientes' },
		{ value: 'primary_release_date.asc', label: 'Más antiguos' }
	];
	const ratingOptions = [0, 5, 6, 7, 8, 9];

	let filtersOpen = $state(false);
	let filters = $state({
		mediaType: 'movie' as 'movie' | 'tv',
		genreIds: [] as number[],
		yearFrom: '',
		yearTo: '',
		minRating: 0,
		sortBy: 'popularity.desc' as TmdbSortBy
	});
	let activeFilterSummary = $state<string | null>(null);

	const availableGenres = $derived(filters.mediaType === 'movie' ? data.movieGenres : data.tvGenres);

	function toggleGenre(id: number) {
		filters.genreIds = filters.genreIds.includes(id)
			? filters.genreIds.filter((g) => g !== id)
			: [...filters.genreIds, id];
	}

	function setMediaType(mediaType: 'movie' | 'tv') {
		if (filters.mediaType === mediaType) return;
		filters.mediaType = mediaType;
		filters.genreIds = [];
	}

	function buildSummary(): string {
		const parts = [filters.mediaType === 'movie' ? 'Película' : 'Serie'];
		if (filters.genreIds.length > 0) {
			const names = availableGenres
				.filter((g) => filters.genreIds.includes(g.id))
				.map((g) => g.name);
			if (names.length > 0) parts.push(names.join(', '));
		}
		if (filters.yearFrom || filters.yearTo) {
			parts.push(`${filters.yearFrom || '...'}–${filters.yearTo || '...'}`);
		}
		if (filters.minRating > 0) parts.push(`★ ${filters.minRating}+`);
		const sortLabel = sortOptions.find((s) => s.value === filters.sortBy)?.label;
		if (sortLabel) parts.push(sortLabel);
		return parts.join(' · ');
	}

	async function applyFilters() {
		loading = true;
		errorMessage = null;
		query = '';
		try {
			const params = new URLSearchParams();
			params.set('mediaType', filters.mediaType);
			if (filters.genreIds.length > 0) params.set('genre', filters.genreIds.join(','));
			if (filters.yearFrom) params.set('yearFrom', filters.yearFrom);
			if (filters.yearTo) params.set('yearTo', filters.yearTo);
			if (filters.minRating > 0) params.set('minRating', String(filters.minRating));
			params.set('sortBy', filters.sortBy);

			const response = await fetch(`/api/discover?${params}`);
			if (!response.ok) throw new Error('No se pudo filtrar.');
			results = await response.json();
			searched = true;
			activeFilterSummary = buildSummary();
		} catch {
			errorMessage = 'No se pudieron cargar títulos con esos filtros.';
		} finally {
			loading = false;
		}
	}

	function clearFilters() {
		filters = {
			mediaType: 'movie',
			genreIds: [],
			yearFrom: '',
			yearTo: '',
			minRating: 0,
			sortBy: 'popularity.desc'
		};
		activeFilterSummary = null;
		searched = false;
		results = [];
	}

	async function runSearch(event: SubmitEvent) {
		event.preventDefault();
		if (!query.trim()) return;

		activeFilterSummary = null;
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

	let appliedFromUrl = $state(false);

	$effect(() => {
		if (appliedFromUrl) return;
		const genreParam = page.url.searchParams.get('genre');
		const mediaTypeParam = page.url.searchParams.get('mediaType');
		if (genreParam && (mediaTypeParam === 'movie' || mediaTypeParam === 'tv')) {
			appliedFromUrl = true;
			filters.mediaType = mediaTypeParam;
			filters.genreIds = genreParam
				.split(',')
				.map(Number)
				.filter((n) => Number.isInteger(n));
			filtersOpen = true;
			applyFilters();
		}
	});

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

<form onsubmit={runSearch} class="mb-3 flex gap-2">
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

<button
	onclick={() => (filtersOpen = !filtersOpen)}
	class="mb-3 flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary"
>
	{filtersOpen ? '▾' : '▸'} Filtros avanzados
</button>

{#if filtersOpen}
	<div class="mb-6 flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
		<div>
			<p class="mb-1.5 text-xs font-semibold text-text-secondary uppercase">Tipo</p>
			<div class="flex gap-2">
				<button
					onclick={() => setMediaType('movie')}
					class="rounded-full px-3 py-1.5 text-sm font-medium transition-colors {filters.mediaType ===
					'movie'
						? 'bg-purple-500 text-purple-50'
						: 'bg-shade-950 text-text-secondary hover:bg-surface-hover'}"
				>
					Película
				</button>
				<button
					onclick={() => setMediaType('tv')}
					class="rounded-full px-3 py-1.5 text-sm font-medium transition-colors {filters.mediaType ===
					'tv'
						? 'bg-purple-500 text-purple-50'
						: 'bg-shade-950 text-text-secondary hover:bg-surface-hover'}"
				>
					Serie
				</button>
			</div>
		</div>

		{#if availableGenres.length > 0}
			<div>
				<p class="mb-1.5 text-xs font-semibold text-text-secondary uppercase">Géneros</p>
				<div class="flex flex-wrap gap-2">
					{#each availableGenres as genre (genre.id)}
						<button
							onclick={() => toggleGenre(genre.id)}
							class="rounded-full px-3 py-1 text-xs font-medium transition-colors {filters.genreIds.includes(
								genre.id
							)
								? 'bg-purple-500 text-purple-50'
								: 'bg-shade-950 text-text-secondary hover:bg-surface-hover'}"
						>
							{genre.name}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<div class="flex flex-wrap gap-6">
			<div>
				<p class="mb-1.5 text-xs font-semibold text-text-secondary uppercase">Año desde</p>
				<select
					bind:value={filters.yearFrom}
					class="rounded border border-border bg-shade-950 px-2 py-1.5 text-sm text-text-primary"
				>
					<option value="">Cualquiera</option>
					{#each years as year (year)}
						<option value={String(year)}>{year}</option>
					{/each}
				</select>
			</div>

			<div>
				<p class="mb-1.5 text-xs font-semibold text-text-secondary uppercase">Año hasta</p>
				<select
					bind:value={filters.yearTo}
					class="rounded border border-border bg-shade-950 px-2 py-1.5 text-sm text-text-primary"
				>
					<option value="">Cualquiera</option>
					{#each years as year (year)}
						<option value={String(year)}>{year}</option>
					{/each}
				</select>
			</div>

			<div>
				<p class="mb-1.5 text-xs font-semibold text-text-secondary uppercase">
					Calificación mínima
				</p>
				<select
					bind:value={filters.minRating}
					class="rounded border border-border bg-shade-950 px-2 py-1.5 text-sm text-text-primary"
				>
					{#each ratingOptions as rating (rating)}
						<option value={rating}>{rating === 0 ? 'Cualquiera' : `★ ${rating}+`}</option>
					{/each}
				</select>
			</div>

			<div>
				<p class="mb-1.5 text-xs font-semibold text-text-secondary uppercase">Ordenar por</p>
				<select
					bind:value={filters.sortBy}
					class="rounded border border-border bg-shade-950 px-2 py-1.5 text-sm text-text-primary"
				>
					{#each sortOptions as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="flex gap-3">
			<button
				onclick={applyFilters}
				disabled={loading}
				class="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-purple-50 transition hover:bg-purple-700 disabled:opacity-50"
			>
				{loading ? 'Aplicando…' : 'Aplicar filtros'}
			</button>
			<button
				onclick={clearFilters}
				class="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
			>
				Limpiar
			</button>
		</div>
	</div>
{/if}

{#if activeFilterSummary}
	<div class="mb-4 flex items-center gap-2 text-sm">
		<span class="text-text-secondary">Filtros:</span>
		<span class="rounded-full bg-purple-500 px-3 py-1 font-medium text-purple-50"
			>{activeFilterSummary}</span
		>
		<button onclick={clearFilters} class="text-text-secondary hover:text-text-primary hover:underline">
			✕ Quitar filtros
		</button>
	</div>
{/if}

{#if errorMessage}
	<p class="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-400">{errorMessage}</p>
{/if}

{#if searched}
	<CardGrid items={results} emptyMessage="Sin resultados.">
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
{:else if !loading}
	<p class="text-text-secondary">Escribe un título o usa los filtros avanzados para explorar TMDb.</p>
{/if}
