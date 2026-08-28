<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const summary = $derived(form && 'summary' in form ? form.summary : null);

	function formatDate(iso: string | null): string {
		if (!iso) return 'nunca';
		return new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
	}
</script>

<svelte:head><title>Ajustes · Mi Biblioteca</title></svelte:head>

<div class="mx-auto flex max-w-lg flex-col gap-6 py-8">
	<h1 class="text-2xl font-bold text-text-primary">Ajustes</h1>

	<section class="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
		<div class="flex items-center gap-3">
			<span class="text-2xl">🎬</span>
			<div>
				<h2 class="font-semibold text-text-primary">Trakt</h2>
				<p class="text-sm text-text-secondary">
					Importá tus películas y series vistas, y tu watchlist, desde tu cuenta de Trakt.
				</p>
			</div>
		</div>

		{#if data.trakt}
			<div class="flex flex-col gap-1 rounded-lg bg-surface-hover px-3 py-2 text-sm">
				<p class="text-text-primary">
					Conectado como <span class="font-medium">{data.trakt.username ?? '(sin username)'}</span>
				</p>
				<p class="text-text-secondary">Última sincronización: {formatDate(data.trakt.lastSyncedAt)}</p>
			</div>

			{#if form?.error}
				<p class="text-sm text-red-400">{form.error}</p>
			{/if}

			{#if summary}
				<div class="rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-sm text-text-primary">
					<p class="font-medium">Sincronización completa.</p>
					<ul class="mt-1 list-inside list-disc text-text-secondary">
						<li>{summary.moviesWatched} películas vistas</li>
						<li>{summary.showsWatched} series vistas ({summary.episodesMarked} episodios)</li>
						<li>{summary.watchlistAdded} agregados a la watchlist</li>
						{#if summary.skipped > 0}
							<li>{summary.skipped} omitidos (sin id de TMDb)</li>
						{/if}
					</ul>
				</div>
			{/if}

			<div class="flex gap-2">
				<form method="POST" action="?/sync">
					<button
						type="submit"
						class="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-purple-50 transition hover:bg-purple-700"
					>
						Sincronizar ahora
					</button>
				</form>
				<form method="POST" action="?/disconnect">
					<button
						type="submit"
						class="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
					>
						Desconectar
					</button>
				</form>
			</div>
		{:else}
			<a
				href="/api/trakt/connect"
				class="w-fit rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-purple-50 transition hover:bg-purple-700"
			>
				Conectar con Trakt
			</a>
		{/if}
	</section>
</div>
