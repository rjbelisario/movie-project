<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	const links = [
		{ href: '/', label: 'Inicio' },
		{ href: '/buscar', label: 'Buscar' },
		{ href: '/watchlist', label: 'Watchlist' },
		{ href: '/vistos', label: 'Vistos' },
		{ href: '/biblioteca', label: 'Biblioteca' },
		{ href: '/estadisticas', label: 'Estadísticas' }
	];
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-screen bg-background text-text-primary">
	<header
		class="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md"
	>
		<nav class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
			<a href="/" class="flex shrink-0 items-center gap-1.5 font-bold tracking-tight">
				<span class="text-purple-400">🎬</span> Mi Biblioteca
			</a>
			<div class="scroll-row flex gap-1 overflow-x-auto text-sm">
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
			</div>
		</nav>
	</header>

	<main class="mx-auto max-w-6xl px-4 py-6">
		{@render children()}
	</main>
</div>
