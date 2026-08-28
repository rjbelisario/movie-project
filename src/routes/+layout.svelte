<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import type { LayoutData } from './$types';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();

	const links = [
		{ href: '/', label: 'Inicio' },
		{ href: '/buscar', label: 'Buscar' },
		{ href: '/recomendaciones', label: 'Recomendaciones' },
		{ href: '/watchlist', label: 'Watchlist' },
		{ href: '/vistos', label: 'Vistos' },
		{ href: '/biblioteca', label: 'Biblioteca' },
		{ href: '/estadisticas', label: 'Estadísticas' },
		{ href: '/ajustes', label: 'Ajustes' }
	];

	let mobileMenuOpen = $state(false);

	$effect(() => {
		// Cierra el menú móvil al navegar a otra ruta.
		page.url.pathname;
		mobileMenuOpen = false;
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-screen bg-background text-text-primary">
	<header
		class="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md"
	>
		<div class="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
			<a href="/" class="flex shrink-0 items-center gap-1.5 font-bold tracking-tight">
				<span class="text-purple-400">🎬</span> Mi Biblioteca
			</a>

			{#if data.user}
				<nav class="scroll-row hidden flex-1 gap-1 overflow-x-auto text-sm md:flex">
					{#each links as link (link.href)}
						<a
							href={link.href}
							class="shrink-0 rounded-full px-3 py-1.5 font-medium transition-colors {page.url
								.pathname === link.href
								? 'bg-purple-500 text-purple-50'
								: 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}"
						>
							{link.label}
						</a>
					{/each}
				</nav>
				<div class="ml-auto hidden shrink-0 items-center gap-3 text-sm md:flex">
					<span class="text-text-secondary">{data.user.email}</span>
					<form method="POST" action="/logout">
						<button
							type="submit"
							class="rounded-full border border-border px-3 py-1.5 font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
						>
							Cerrar sesión
						</button>
					</form>
				</div>

				<button
					type="button"
					onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
					aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
					aria-expanded={mobileMenuOpen}
					aria-controls="mobile-menu"
					class="ml-auto flex shrink-0 items-center justify-center rounded-full p-2.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary md:hidden"
				>
					{#if mobileMenuOpen}
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M18 6 6 18" /><path d="m6 6 12 12" />
						</svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" />
						</svg>
					{/if}
				</button>
			{:else}
				<div class="ml-auto flex shrink-0 gap-1 text-sm">
					<a
						href="/login"
						class="shrink-0 rounded-full px-3 py-1.5 font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
					>
						Iniciar sesión
					</a>
					<a
						href="/registro"
						class="shrink-0 rounded-full bg-purple-500 px-3 py-1.5 font-medium text-purple-50 transition-colors hover:bg-purple-600"
					>
						Crear cuenta
					</a>
				</div>
			{/if}
		</div>

		{#if data.user && mobileMenuOpen}
			<nav id="mobile-menu" class="flex flex-col gap-1 border-t border-border px-4 py-3 text-sm md:hidden">
				{#each links as link (link.href)}
					<a
						href={link.href}
						class="rounded-lg px-3 py-2.5 font-medium transition-colors {page.url.pathname ===
						link.href
							? 'bg-purple-500 text-purple-50'
							: 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}"
					>
						{link.label}
					</a>
				{/each}
				<div class="mt-2 flex items-center justify-between gap-3 border-t border-border pt-3">
					<span class="truncate text-text-secondary">{data.user.email}</span>
					<form method="POST" action="/logout">
						<button
							type="submit"
							class="shrink-0 rounded-full border border-border px-3 py-1.5 font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
						>
							Cerrar sesión
						</button>
					</form>
				</div>
			</nav>
		{/if}
	</header>

	<main class="mx-auto max-w-6xl px-4 py-6">
		{@render children()}
	</main>
</div>
