<script lang="ts">
	import LibraryGrid from '$lib/components/LibraryGrid.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Watchlist — Mi Biblioteca</title></svelte:head>

<div class="mb-6">
	<h1 class="text-xl font-semibold text-text-primary">Watchlist</h1>
	<p class="text-sm text-text-secondary">Títulos que quieres ver.</p>
</div>

<LibraryGrid
	items={data.items}
	emptyMessage="Tu watchlist está vacía. Ve a Buscar para agregar títulos que quieras ver."
/>
