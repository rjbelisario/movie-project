<script lang="ts">
	import type { LibraryItem } from '$lib/server/db/schema';

	interface Props {
		item: LibraryItem;
		onUpdate: (updated: LibraryItem) => void;
		onDelete: (id: number) => void;
	}

	let { item, onUpdate, onDelete }: Props = $props();

	// svelte-ignore state_referenced_locally -- copia editable intencional, no un valor derivado
	const { status: initialStatus, rating: initialRating, notes: initialNotes } = item;
	let status = $state(initialStatus);
	let rating = $state(initialRating ?? 0);
	let notes = $state(initialNotes ?? '');
	let saving = $state(false);
	let deleting = $state(false);

	async function save() {
		saving = true;
		try {
			const response = await fetch(`/api/library/${item.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status, rating: rating || null, notes: notes || null })
			});
			if (response.ok) onUpdate(await response.json());
		} finally {
			saving = false;
		}
	}

	async function remove() {
		deleting = true;
		try {
			const response = await fetch(`/api/library/${item.id}`, { method: 'DELETE' });
			if (response.ok || response.status === 204) onDelete(item.id);
		} finally {
			deleting = false;
		}
	}
</script>

<div class="flex flex-col gap-1.5 text-xs">
	<select
		bind:value={status}
		class="rounded border border-border bg-shade-950 px-1.5 py-1 text-text-primary"
	>
		<option value="planned">Pendiente</option>
		<option value="watching">Viendo</option>
		<option value="completed">Completada</option>
		<option value="dropped">Abandonada</option>
	</select>

	<select
		bind:value={rating}
		class="rounded border border-border bg-shade-950 px-1.5 py-1 text-text-primary"
	>
		<option value={0}>Sin calificar</option>
		{#each [1, 2, 3, 4, 5] as n (n)}
			<option value={n}>{'★'.repeat(n)}</option>
		{/each}
	</select>

	<textarea
		bind:value={notes}
		rows="2"
		placeholder="Notas..."
		class="resize-none rounded border border-border bg-shade-950 px-1.5 py-1 text-text-primary placeholder:text-text-secondary"
	></textarea>

	<div class="flex gap-1.5">
		<button
			onclick={save}
			disabled={saving}
			class="flex-1 rounded bg-purple-600 py-1 font-medium text-purple-50 transition hover:bg-purple-700 disabled:opacity-50"
		>
			{saving ? 'Guardando…' : 'Guardar'}
		</button>
		<button
			onclick={remove}
			disabled={deleting}
			class="rounded bg-red-700 px-2 py-1 font-medium text-shade-10 transition hover:bg-red-500 disabled:opacity-50"
		>
			{deleting ? '…' : 'Eliminar'}
		</button>
	</div>
</div>
