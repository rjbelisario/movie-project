<script lang="ts">
	import CardGrid from './CardGrid.svelte';
	import LibraryItemControls from './LibraryItemControls.svelte';
	import type { LibraryItem } from '$lib/server/db/schema';
	import type { CardItem } from '$lib/types';

	interface Props {
		items: LibraryItem[];
		emptyMessage: string;
	}

	let { items: initialItems, emptyMessage }: Props = $props();

	// svelte-ignore state_referenced_locally -- copia editable intencional, no un valor derivado
	let items = $state<LibraryItem[]>(initialItems);
	$effect(() => {
		items = initialItems;
	});

	function handleUpdate(updated: LibraryItem) {
		items = items.map((item) => (item.id === updated.id ? updated : item));
	}

	function handleDelete(id: number) {
		items = items.filter((item) => item.id !== id);
	}
</script>

<CardGrid {items} {emptyMessage}>
	{#snippet actions(item: CardItem)}
		<LibraryItemControls
			item={item as LibraryItem}
			onUpdate={handleUpdate}
			onDelete={handleDelete}
		/>
	{/snippet}
</CardGrid>
