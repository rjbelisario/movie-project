<script lang="ts">
	import type { LibraryItem } from '$lib/server/db/schema';

	interface Props {
		item: LibraryItem;
		onUpdate: (updated: LibraryItem) => void;
		onDelete: (id: number) => void;
		/** 'compact' para tarjetas (grids/carruseles), 'large' para la página de detalle. */
		size?: 'compact' | 'large';
	}

	let { item, onUpdate, onDelete, size = 'compact' }: Props = $props();

	// svelte-ignore state_referenced_locally -- copia editable intencional, no un valor derivado
	const { status: initialStatus, rating: initialRating, notes: initialNotes } = item;
	let status = $state(initialStatus);
	let rating = $state(initialRating ?? 0);
	let notes = $state(initialNotes ?? '');
	let saving = $state(false);
	let deleting = $state(false);

	const statusOptions: { value: LibraryItem['status']; label: string }[] = [
		{ value: 'planned', label: 'Pendiente' },
		{ value: 'completed', label: 'Completada' }
	];

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

{#if size === 'large'}
	<div class="flex flex-col gap-3">
		<div class="flex flex-wrap gap-2">
			{#each statusOptions as option (option.value)}
				<button
					onclick={() => (status = option.value)}
					class="rounded-full px-3 py-1.5 text-sm font-medium transition-colors {status ===
					option.value
						? 'bg-purple-500 text-purple-50'
						: 'bg-surface text-text-secondary hover:bg-surface-hover'}"
				>
					{option.label}
				</button>
			{/each}
		</div>

		<div class="flex flex-wrap items-center gap-4">
			<div class="flex items-center gap-1">
				{#each [1, 2, 3, 4, 5] as n (n)}
					<button
						onclick={() => (rating = rating === n ? 0 : n)}
						class="text-xl leading-none {n <= rating ? 'text-rating' : 'text-shade-700'}"
						aria-label="Calificar {n} de 5"
					>
						★
					</button>
				{/each}
			</div>

			<textarea
				bind:value={notes}
				rows="1"
				placeholder="Notas personales..."
				class="min-w-48 flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary"
			></textarea>
		</div>

		<div class="flex gap-3">
			<button
				onclick={save}
				disabled={saving}
				class="rounded-lg bg-purple-600 px-4 py-2 font-medium text-purple-50 transition hover:bg-purple-700 disabled:opacity-50"
			>
				{saving ? 'Guardando…' : 'Guardar'}
			</button>
			<button
				onclick={remove}
				disabled={deleting}
				class="rounded-lg border border-border px-4 py-2 font-medium text-text-primary transition hover:bg-red-700 hover:text-shade-10 disabled:opacity-50"
			>
				{deleting ? '…' : 'Quitar de la biblioteca'}
			</button>
		</div>
	</div>
{:else}
	<div class="flex flex-col gap-1.5 text-xs">
		<select
			bind:value={status}
			class="rounded border border-border bg-shade-950 px-1.5 py-1 text-text-primary"
		>
			{#each statusOptions as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
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
{/if}
