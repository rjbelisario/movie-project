<script lang="ts">
	import type { CardItem } from '$lib/types';
	import MovieCard from './MovieCard.svelte';

	interface Props {
		title: string;
		items: CardItem[];
	}

	let { title, items }: Props = $props();

	function keyOf(item: CardItem): string {
		return item.id !== undefined ? `library-${item.id}` : `tmdb-${item.mediaType}-${item.tmdbId}`;
	}
</script>

{#if items.length > 0}
	<section class="mb-8">
		<h2 class="mb-3 text-lg font-semibold text-text-primary">{title}</h2>
		<div class="scroll-row flex gap-3 overflow-x-auto pb-2">
			{#each items as item (keyOf(item))}
				<div class="w-32 shrink-0 sm:w-40">
					<MovieCard {item} dense />
				</div>
			{/each}
		</div>
	</section>
{/if}
