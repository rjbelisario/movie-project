<script lang="ts">
	import CardGrid from '$lib/components/CardGrid.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const tiles = $derived([
		{ label: 'Total en biblioteca', value: data.stats.total },
		{ label: 'Viendo ahora', value: data.stats.byStatus.watching },
		{ label: 'Completadas', value: data.stats.byStatus.completed },
		{
			label: 'Rating promedio',
			value: data.stats.averageRating ? data.stats.averageRating.toFixed(1) : '—'
		}
	]);
</script>

<svelte:head><title>Mi Biblioteca de Películas y Series</title></svelte:head>

<section class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
	{#each tiles as tile (tile.label)}
		<div class="rounded-lg bg-neutral-800 p-4 text-center">
			<p class="text-2xl font-bold">{tile.value}</p>
			<p class="text-xs text-neutral-400">{tile.label}</p>
		</div>
	{/each}
</section>

<section>
	<div class="mb-3 flex items-center justify-between">
		<h2 class="text-lg font-semibold">Agregado recientemente</h2>
		<a href="/biblioteca" class="text-sm text-blue-400 hover:underline">Ver toda la biblioteca →</a
		>
	</div>

	<CardGrid
		items={data.recent}
		emptyMessage="Tu biblioteca está vacía. Ve a Buscar para agregar tu primera película o serie."
	/>
</section>
