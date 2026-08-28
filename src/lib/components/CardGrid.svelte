<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CardItem } from '$lib/types';
	import MovieCard from './MovieCard.svelte';

	interface Props {
		items: CardItem[];
		emptyMessage?: string;
		actions?: Snippet<[CardItem]>;
	}

	let { items, emptyMessage = 'No hay resultados.', actions }: Props = $props();

	function keyOf(item: CardItem): string {
		return item.id !== undefined ? `library-${item.id}` : `tmdb-${item.mediaType}-${item.tmdbId}`;
	}
</script>

{#if items.length === 0}
	<p class="py-12 text-center text-text-secondary">{emptyMessage}</p>
{:else}
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
		{#each items as item (keyOf(item))}
			<MovieCard {item} {actions} />
		{/each}
	</div>
{/if}
