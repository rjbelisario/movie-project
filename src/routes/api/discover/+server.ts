import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { discoverTitles } from '$lib/server/tmdb';
import type { TmdbMediaType, TmdbSortBy } from '$lib/server/tmdb';

const VALID_SORTS: TmdbSortBy[] = [
	'popularity.desc',
	'vote_average.desc',
	'primary_release_date.desc',
	'primary_release_date.asc'
];

function parseIntParam(value: string | null): number | undefined {
	if (!value) return undefined;
	const n = Number(value);
	return Number.isInteger(n) ? n : undefined;
}

export const GET: RequestHandler = async ({ url }) => {
	const mediaType = url.searchParams.get('mediaType');
	if (mediaType !== 'movie' && mediaType !== 'tv') {
		error(400, `mediaType inválido: ${mediaType}`);
	}

	const genreParam = url.searchParams.get('genre');
	const genreIds = genreParam
		? genreParam
				.split(',')
				.map(Number)
				.filter((n) => Number.isInteger(n))
		: undefined;

	const sortByParam = url.searchParams.get('sortBy');
	const sortBy = VALID_SORTS.includes(sortByParam as TmdbSortBy)
		? (sortByParam as TmdbSortBy)
		: undefined;

	const results = await discoverTitles(mediaType as TmdbMediaType, {
		genreIds,
		yearFrom: parseIntParam(url.searchParams.get('yearFrom')),
		yearTo: parseIntParam(url.searchParams.get('yearTo')),
		minRating: parseIntParam(url.searchParams.get('minRating')),
		sortBy,
		originalLanguage: url.searchParams.get('language') ?? undefined
	});
	return json(results);
};
