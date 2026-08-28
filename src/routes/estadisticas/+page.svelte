<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const statusLabels: Record<string, string> = {
		planned: 'Pendiente',
		watching: 'Viendo',
		completed: 'Completada',
		dropped: 'Abandonada'
	};

	const statusRows = $derived(
		Object.entries(data.stats.byStatus).map(([key, count]) => ({
			label: statusLabels[key] ?? key,
			count
		}))
	);

	const mediaTypeRows = $derived([
		{ label: 'Películas', count: data.stats.byMediaType.movie },
		{ label: 'Series', count: data.stats.byMediaType.tv }
	]);

	const maxStatus = $derived(Math.max(1, ...statusRows.map((r) => r.count)));
	const maxGenre = $derived(Math.max(1, ...data.stats.topGenres.map((g) => g.count)));
	const maxMediaType = $derived(Math.max(1, ...mediaTypeRows.map((r) => r.count)));
</script>

<svelte:head><title>Estadísticas — Mi Biblioteca</title></svelte:head>

<h1 class="mb-6 text-xl font-semibold text-text-primary">Estadísticas de mi biblioteca</h1>

{#if data.stats.total === 0}
	<p class="text-text-secondary">
		Todavía no hay datos suficientes. Agrega títulos desde <a
			href="/buscar"
			class="text-emphasis hover:underline">Buscar</a
		> para ver estadísticas.
	</p>
{:else}
	<div class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
		<div class="rounded-lg bg-surface p-4 text-center">
			<p class="text-2xl font-bold text-text-primary">{data.stats.total}</p>
			<p class="text-xs text-text-secondary">Títulos en total</p>
		</div>
		<div class="rounded-lg bg-surface p-4 text-center">
			<p class="text-2xl font-bold text-text-primary">
				{data.stats.averageRating ? data.stats.averageRating.toFixed(2) : '—'}
			</p>
			<p class="text-xs text-text-secondary">Rating promedio</p>
		</div>
	</div>

	<div class="grid gap-8 md:grid-cols-2">
		<section>
			<h2 class="mb-3 text-sm font-semibold text-text-secondary">Distribución por estado</h2>
			<div class="flex flex-col gap-2">
				{#each statusRows as row (row.label)}
					<div class="flex items-center gap-3 text-sm">
						<span class="w-24 shrink-0 text-text-secondary">{row.label}</span>
						<div class="h-3 flex-1 rounded bg-surface">
							<div
								class="h-3 rounded bg-purple-500"
								style="width: {(row.count / maxStatus) * 100}%"
							></div>
						</div>
						<span class="w-6 shrink-0 text-right text-text-secondary">{row.count}</span>
					</div>
				{/each}
			</div>
		</section>

		<section>
			<h2 class="mb-3 text-sm font-semibold text-text-secondary">Películas vs. series</h2>
			<div class="flex flex-col gap-2">
				{#each mediaTypeRows as row (row.label)}
					<div class="flex items-center gap-3 text-sm">
						<span class="w-24 shrink-0 text-text-secondary">{row.label}</span>
						<div class="h-3 flex-1 rounded bg-surface">
							<div
								class="h-3 rounded bg-blue-500"
								style="width: {(row.count / maxMediaType) * 100}%"
							></div>
						</div>
						<span class="w-6 shrink-0 text-right text-text-secondary">{row.count}</span>
					</div>
				{/each}
			</div>
		</section>

		<section class="md:col-span-2">
			<h2 class="mb-3 text-sm font-semibold text-text-secondary">Géneros más frecuentes</h2>
			{#if data.stats.topGenres.length === 0}
				<p class="text-sm text-text-secondary">
					Sin datos de género todavía (los títulos agregados desde Buscar no traen género hasta
					que se edite su detalle).
				</p>
			{:else}
				<div class="flex flex-col gap-2">
					{#each data.stats.topGenres as genre (genre.genre)}
						<div class="flex items-center gap-3 text-sm">
							<span class="w-32 shrink-0 truncate text-text-secondary">{genre.genre}</span>
							<div class="h-3 flex-1 rounded bg-surface">
								<div
									class="h-3 rounded bg-green-500"
									style="width: {(genre.count / maxGenre) * 100}%"
								></div>
							</div>
							<span class="w-6 shrink-0 text-right text-text-secondary">{genre.count}</span>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>
{/if}
