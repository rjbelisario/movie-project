<script lang="ts">
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>Crear cuenta · Mi Biblioteca</title></svelte:head>

<div class="mx-auto flex max-w-sm flex-col gap-6 py-12">
	<h1 class="text-2xl font-bold text-text-primary">Crear cuenta</h1>

	<form method="POST" class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<label for="email" class="text-sm font-medium text-text-secondary">Email</label>
			<input
				id="email"
				name="email"
				type="email"
				required
				autocomplete="email"
				value={form?.email ?? ''}
				class="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary"
			/>
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="password" class="text-sm font-medium text-text-secondary">Contraseña</label>
			<input
				id="password"
				name="password"
				type="password"
				required
				minlength="8"
				autocomplete="new-password"
				class="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary"
			/>
			<p class="text-xs text-text-secondary">Mínimo 8 caracteres.</p>
		</div>

		{#if form?.error}
			<p class="text-sm text-red-400">{form.error}</p>
		{/if}

		<button
			type="submit"
			class="rounded-lg bg-purple-600 px-4 py-2 font-medium text-purple-50 transition hover:bg-purple-700"
		>
			Crear cuenta
		</button>
	</form>

	<p class="text-sm text-text-secondary">
		¿Ya tenés cuenta? <a href="/login" class="text-purple-400 hover:underline">Iniciá sesión</a>
	</p>
</div>
