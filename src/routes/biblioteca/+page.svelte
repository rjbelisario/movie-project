<script lang="ts">
	import { goto } from '$app/navigation';
	import LibraryGrid from '$lib/components/LibraryGrid.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function updateFilter(key: 'status' | 'mediaType', value: string) {
		const url = new URL(window.location.href);
		if (value) url.searchParams.set(key, value);
		else url.searchParams.delete(key);
		goto(url.pathname + url.search);
	}
</script>

<svelte:head><title>Biblioteca — Mi Biblioteca</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
	<div>
		<h1 class="text-xl font-semibold text-text-primary">Mi biblioteca</h1>
		<p class="text-sm text-text-secondary">Todos tus títulos, en cualquier estado.</p>
	</div>

	<div class="flex gap-2">
		<select
			value={data.status ?? ''}
			onchange={(e) => updateFilter('status', e.currentTarget.value)}
			class="rounded border border-border bg-surface px-3 py-1.5 text-sm text-text-primary"
		>
			<option value="">Todos los estados</option>
			<option value="planned">Watchlist</option>
			<option value="completed">Vistas</option>
		</select>

		<select
			value={data.mediaType ?? ''}
			onchange={(e) => updateFilter('mediaType', e.currentTarget.value)}
			class="rounded border border-border bg-surface px-3 py-1.5 text-sm text-text-primary"
		>
			<option value="">Películas y series</option>
			<option value="movie">Solo películas</option>
			<option value="tv">Solo series</option>
		</select>
	</div>
</div>

<LibraryGrid
	items={data.items}
	emptyMessage="No hay títulos con estos filtros. Ve a Buscar para agregar alguno."
/>
