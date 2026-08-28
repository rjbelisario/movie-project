<script lang="ts">
	import { goto } from '$app/navigation';
	import CardGrid from '$lib/components/CardGrid.svelte';
	import LibraryItemControls from '$lib/components/LibraryItemControls.svelte';
	import type { LibraryItem } from '$lib/server/db/schema';
	import type { CardItem } from '$lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally -- copia editable intencional, no un valor derivado
	const initialItems = data.items;
	let items = $state<LibraryItem[]>(initialItems);
	$effect(() => {
		items = data.items;
	});

	function updateFilter(key: 'status' | 'mediaType', value: string) {
		const url = new URL(window.location.href);
		if (value) url.searchParams.set(key, value);
		else url.searchParams.delete(key);
		goto(url.pathname + url.search);
	}

	function handleUpdate(updated: LibraryItem) {
		items = items.map((item) => (item.id === updated.id ? updated : item));
	}

	function handleDelete(id: number) {
		items = items.filter((item) => item.id !== id);
	}
</script>

<svelte:head><title>Biblioteca — Mi Biblioteca</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
	<h1 class="text-xl font-semibold text-text-primary">Mi biblioteca</h1>

	<div class="flex gap-2">
		<select
			value={data.status ?? ''}
			onchange={(e) => updateFilter('status', e.currentTarget.value)}
			class="rounded border border-border bg-surface px-3 py-1.5 text-sm text-text-primary"
		>
			<option value="">Todos los estados</option>
			<option value="planned">Pendiente</option>
			<option value="watching">Viendo</option>
			<option value="completed">Completada</option>
			<option value="dropped">Abandonada</option>
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

<CardGrid
	{items}
	emptyMessage="No hay títulos con estos filtros. Ve a Buscar para agregar alguno."
>
	{#snippet actions(item: CardItem)}
		<LibraryItemControls item={item as LibraryItem} onUpdate={handleUpdate} onDelete={handleDelete} />
	{/snippet}
</CardGrid>
