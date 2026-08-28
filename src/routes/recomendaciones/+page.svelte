<script lang="ts">
	import CardGrid from '$lib/components/CardGrid.svelte';
	import type { CardItem } from '$lib/types';
	import type { LibraryItem } from '$lib/server/db/schema';
	import type { RecommendedItem } from '$lib/server/recommendations';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const MORE_BATCH_SIZE = 12;

	let itemStatus = $state(new Map<number, LibraryItem['status']>());
	let addingKey = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let visibleMoreCount = $state(0);

	async function addItem(item: CardItem, status: LibraryItem['status']) {
		const key = `${item.tmdbId}:${status}`;
		addingKey = key;
		try {
			const response = await fetch('/api/library', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tmdbId: item.tmdbId,
					mediaType: item.mediaType,
					title: item.title,
					posterPath: item.posterPath,
					overview: item.overview,
					releaseDate: item.releaseDate,
					genres: item.genres ?? [],
					status
				})
			});
			if (!response.ok) throw new Error('No se pudo agregar.');
			itemStatus = new Map(itemStatus).set(item.tmdbId, status);
		} catch {
			errorMessage = 'No se pudo agregar el título a la biblioteca.';
		} finally {
			addingKey = null;
		}
	}

	const statusLabels: Record<NonNullable<LibraryItem['status']>, string> = {
		planned: '+ En watchlist',
		completed: '✓ Vista'
	};
</script>

<svelte:head><title>Recomendaciones — Mi Biblioteca</title></svelte:head>

<div class="mb-6 flex flex-wrap items-start justify-between gap-3">
	<div>
		<h1 class="mb-1 text-xl font-semibold text-text-primary">Recomendadas para vos</h1>
		<p class="text-sm text-text-secondary">
			Basado en los géneros, época, país, reparto y temas de lo que ya viste y calificaste.
		</p>
	</div>
	<form method="POST" action="?/refresh">
		<button
			type="submit"
			class="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
		>
			↻ Actualizar
		</button>
	</form>
</div>

{#if errorMessage}
	<p class="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-400">{errorMessage}</p>
{/if}

{#snippet cardActions(item: CardItem)}
	{@const reasons = (item as RecommendedItem).reasons}
	{@const status = itemStatus.get(item.tmdbId)}
	{#if reasons?.length}
		<ul class="mb-2 space-y-0.5 text-xs text-text-secondary">
			{#each reasons as reason (reason)}
				<li class="line-clamp-1">✦ {reason}</li>
			{/each}
		</ul>
	{/if}
	{#if status}
		<span class="block w-full rounded bg-green-700/40 py-1.5 text-center text-sm text-green-400">
			{statusLabels[status]}
		</span>
	{:else}
		<div class="flex gap-2">
			<button
				onclick={() => addItem(item, 'completed')}
				disabled={addingKey !== null}
				class="flex-1 rounded bg-purple-600 py-1.5 text-sm font-medium text-purple-50 transition hover:bg-purple-700 disabled:opacity-50"
			>
				{addingKey === `${item.tmdbId}:completed` ? 'Guardando…' : '✓ Vista'}
			</button>
			<button
				onclick={() => addItem(item, 'planned')}
				disabled={addingKey !== null}
				class="flex-1 rounded bg-surface-hover py-1.5 text-sm font-medium text-text-primary transition hover:bg-purple-600 disabled:opacity-50"
			>
				{addingKey === `${item.tmdbId}:planned` ? 'Guardando…' : '+ Watchlist'}
			</button>
		</div>
	{/if}
{/snippet}

{#await data.recommendations}
	<p class="py-12 text-center text-text-secondary">Calculando tus recomendaciones…</p>
{:then { items, moreItems }}
	{@const visibleItems = [...items, ...moreItems.slice(0, visibleMoreCount)]}
	{@const hasMore = visibleMoreCount < moreItems.length}

	<CardGrid
		items={visibleItems}
		emptyMessage="Todavía no hay recomendaciones para vos."
		actions={cardActions}
	/>

	{#if hasMore}
		<div class="mt-6 flex justify-center">
			<button
				onclick={() => (visibleMoreCount += MORE_BATCH_SIZE)}
				class="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
			>
				Ver más
			</button>
		</div>
	{/if}
{:catch}
	<p class="text-text-secondary">No se pudieron calcular recomendaciones en este momento.</p>
{/await}
