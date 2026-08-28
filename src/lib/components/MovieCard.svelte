<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CardItem } from '$lib/types';
	import { posterUrl } from '$lib/tmdb-image';

	interface Props {
		item: CardItem;
		actions?: Snippet<[CardItem]>;
	}

	let { item, actions }: Props = $props();

	const poster = $derived(posterUrl(item.posterPath, 'w342'));
	const year = $derived(item.releaseDate ? item.releaseDate.slice(0, 4) : null);
	const mediaTypeLabel = $derived(item.mediaType === 'movie' ? 'Película' : 'Serie');

	const statusLabels: Record<NonNullable<CardItem['status']>, string> = {
		planned: 'Pendiente',
		watching: 'Viendo',
		completed: 'Completada',
		dropped: 'Abandonada'
	};

	const statusColors: Record<NonNullable<CardItem['status']>, string> = {
		planned: 'bg-neutral-700 text-neutral-200',
		watching: 'bg-blue-600 text-white',
		completed: 'bg-green-600 text-white',
		dropped: 'bg-red-700 text-white'
	};
</script>

<article
	class="flex flex-col overflow-hidden rounded-lg bg-neutral-800 shadow transition hover:scale-105 hover:shadow-xl"
>
	<div class="relative aspect-2/3 w-full bg-neutral-700">
		{#if poster}
			<img src={poster} alt={item.title} class="h-full w-full object-cover" loading="lazy" />
		{:else}
			<div class="flex h-full w-full items-center justify-center p-2 text-center text-sm text-neutral-400">
				Sin póster
			</div>
		{/if}

		<span
			class="absolute top-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white"
		>
			{mediaTypeLabel}
		</span>

		{#if item.status}
			<span
				class="absolute top-2 right-2 rounded px-2 py-0.5 text-xs font-medium {statusColors[
					item.status
				]}"
			>
				{statusLabels[item.status]}
			</span>
		{/if}
	</div>

	<div class="flex flex-1 flex-col gap-2 p-3">
		<h3 class="line-clamp-2 font-semibold text-neutral-100">{item.title}</h3>

		<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400">
			{#if year}<span>{year}</span>{/if}
			{#if item.genres && item.genres.length > 0}
				<span class="line-clamp-1">{item.genres.join(', ')}</span>
			{/if}
		</div>

		{#if item.rating}
			<div class="text-sm text-amber-400" aria-label="Calificación: {item.rating} de 5">
				{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
			</div>
		{/if}

		{#if item.notes}
			<p class="line-clamp-2 text-xs text-neutral-400">{item.notes}</p>
		{/if}

		{#if actions}
			<div class="mt-auto pt-2">
				{@render actions(item)}
			</div>
		{/if}
	</div>
</article>
