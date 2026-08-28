<script lang="ts">
	import LibraryGrid from '$lib/components/LibraryGrid.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Vistos — Mi Biblioteca</title></svelte:head>

<div class="mb-6">
	<h1 class="text-xl font-semibold text-text-primary">Vistos</h1>
	<p class="text-sm text-text-secondary">Tu historial: títulos que ya completaste.</p>
</div>

<LibraryGrid
	items={data.items}
	emptyMessage="Todavía no has completado ningún título. Márcalos como 'Completada' desde su ficha para que aparezcan aquí."
/>
