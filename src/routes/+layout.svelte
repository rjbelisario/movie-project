<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	const links = [
		{ href: '/', label: 'Inicio' },
		{ href: '/buscar', label: 'Buscar' },
		{ href: '/biblioteca', label: 'Biblioteca' },
		{ href: '/estadisticas', label: 'Estadísticas' }
	];
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-screen bg-neutral-900 text-neutral-100">
	<header class="border-b border-neutral-800">
		<nav class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
			<span class="font-bold tracking-tight">🎬 Mi Biblioteca</span>
			<div class="flex gap-4 text-sm">
				{#each links as link (link.href)}
					<a
						href={link.href}
						class="rounded px-2 py-1 transition hover:bg-neutral-800 {page.url.pathname ===
						link.href
							? 'bg-neutral-800 text-white'
							: 'text-neutral-400'}"
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
