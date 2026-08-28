<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CardItem } from '$lib/types';
	import { posterUrl } from '$lib/tmdb-image';

	interface Props {
		item: CardItem;
		actions?: Snippet<[CardItem]>;
		/** Tile compacta para carruseles (solo poster + título superpuesto), sin footer de metadata. */
		dense?: boolean;
	}

	let { item, actions, dense = false }: Props = $props();

	const detailHref = $derived(`/titulo/${item.mediaType}/${item.tmdbId}`);
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
		planned: 'bg-shade-700 text-shade-10',
		watching: 'bg-blue-500 text-shade-10',
		completed: 'bg-green-500 text-shade-950',
		dropped: 'bg-red-500 text-shade-10'
	};
</script>

<article
	class="group flex flex-col overflow-hidden rounded-xl border border-transparent bg-surface shadow transition-all duration-200 hover:-translate-y-1 hover:border-purple-500 hover:shadow-lg"
>
	<a href={detailHref} class="flex flex-1 flex-col">
		<div class="relative aspect-2/3 w-full overflow-hidden bg-shade-800">
			{#if poster}
				<img
					src={poster}
					alt={item.title}
					class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
					loading="lazy"
				/>
			{:else}
				<div
					class="flex h-full w-full items-center justify-center p-2 text-center text-sm text-text-secondary"
				>
					Sin póster
				</div>
			{/if}

			<span
				class="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-shade-10 uppercase"
			>
				{mediaTypeLabel}
			</span>

			{#if item.status}
				<span
					class="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold {statusColors[
						item.status
					]}"
				>
					{statusLabels[item.status]}
				</span>
			{/if}

			{#if dense}
				<div
					class="absolute inset-x-0 bottom-0 flex h-2/3 flex-col justify-end bg-linear-to-t from-black/95 via-black/40 to-transparent p-2.5"
				>
					<h3 class="line-clamp-2 text-sm font-semibold text-shade-10">{item.title}</h3>
					{#if year}<p class="text-xs text-shade-300">{year}</p>{/if}
				</div>
			{/if}
		</div>

		{#if !dense}
			<div class="flex flex-1 flex-col gap-2 p-3">
				<h3 class="line-clamp-2 font-semibold text-text-primary">{item.title}</h3>

				<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
					{#if year}<span>{year}</span>{/if}
					{#if item.genres && item.genres.length > 0}
						<span class="line-clamp-1">{item.genres.join(', ')}</span>
					{/if}
				</div>

				{#if item.rating}
					<div class="text-sm text-rating" aria-label="Calificación: {item.rating} de 5">
						{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
					</div>
				{/if}

				{#if item.notes}
					<p class="line-clamp-2 text-xs text-text-secondary">{item.notes}</p>
				{/if}
			</div>
		{/if}
	</a>

	{#if actions}
		<div class="p-3 pt-0">
			{@render actions(item)}
		</div>
	{/if}
</article>
