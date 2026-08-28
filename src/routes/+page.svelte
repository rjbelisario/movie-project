<script lang="ts">
	import CardGrid from '$lib/components/CardGrid.svelte';
	import CardRow from '$lib/components/CardRow.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const tiles = $derived([
		{ label: 'Total en biblioteca', value: data.stats.total },
		{ label: 'En watchlist', value: data.stats.byStatus.planned },
		{ label: 'Vistas', value: data.stats.byStatus.completed },
		{
			label: 'Rating promedio',
			value: data.stats.averageRating ? data.stats.averageRating.toFixed(1) : '—'
		}
	]);

	const hasDiscoverContent = $derived(
		data.trending.length > 0 ||
			data.popularMovies.length > 0 ||
			data.popularTv.length > 0 ||
			data.upcomingMovies.length > 0
	);
</script>

<svelte:head><title>Mi Biblioteca de Películas y Series</title></svelte:head>

<section class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
	{#each tiles as tile (tile.label)}
		<div class="rounded-xl border border-border bg-surface p-4 text-center">
			<p class="text-2xl font-bold text-text-primary">{tile.value}</p>
			<p class="text-xs text-text-secondary">{tile.label}</p>
		</div>
	{/each}
</section>

{#if data.recent.length > 0}
	<section class="mb-8">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-text-primary">Agregado recientemente</h2>
			<a href="/biblioteca" class="text-sm font-medium text-emphasis hover:underline"
				>Ver toda la biblioteca →</a
			>
		</div>
		<CardGrid items={data.recent} />
	</section>
{/if}

<CardRow title="Tendencias esta semana" items={data.trending} />
<CardRow title="Películas populares" items={data.popularMovies} />
<CardRow title="Series populares" items={data.popularTv} />
<CardRow title="Próximos estrenos" items={data.upcomingMovies} />

{#if data.recent.length === 0 && !hasDiscoverContent}
	<div class="rounded-xl border border-border bg-surface p-8 text-center">
		<p class="mb-2 text-text-primary">Tu biblioteca está vacía y no hay contenido de TMDb.</p>
		<p class="text-sm text-text-secondary">
			Configura <code class="rounded bg-shade-950 px-1.5 py-0.5">TMDB_API_KEY</code> en tu
			<code class="rounded bg-shade-950 px-1.5 py-0.5">.env</code> y ve a
			<a href="/buscar" class="text-emphasis hover:underline">Buscar</a> para agregar tu primer título.
		</p>
	</div>
{/if}
