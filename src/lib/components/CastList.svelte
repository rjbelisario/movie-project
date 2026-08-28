<script lang="ts">
	import { posterUrl } from '$lib/tmdb-image';
	import type { TmdbCastMember } from '$lib/server/tmdb';

	interface Props {
		cast: TmdbCastMember[];
	}

	let { cast }: Props = $props();
</script>

{#if cast.length > 0}
	<section class="mb-8">
		<h2 class="mb-3 text-lg font-semibold text-text-primary">Reparto</h2>
		<div class="scroll-row flex gap-3 overflow-x-auto pb-2">
			{#each cast as member (member.id)}
				<div class="w-24 shrink-0 text-center sm:w-28">
					<div class="mx-auto aspect-square w-full overflow-hidden rounded-full bg-shade-800">
						{#if posterUrl(member.profilePath, 'w185')}
							<img
								src={posterUrl(member.profilePath, 'w185')}
								alt={member.name}
								class="h-full w-full object-cover"
								loading="lazy"
							/>
						{/if}
					</div>
					<p class="mt-2 line-clamp-2 text-xs font-medium text-text-primary">{member.name}</p>
					<p class="line-clamp-1 text-xs text-text-secondary">{member.character}</p>
				</div>
			{/each}
		</div>
	</section>
{/if}
