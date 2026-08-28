import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	// @libsql/client carga su binario nativo (@libsql/linux-x64-gnu) con un require() dinámico
	// que no sobrevive al bundling de adapter-node — se deja como paquete externo para que el
	// servidor construido lo siga resolviendo desde node_modules en runtime.
	ssr: {
		external: ['@libsql/client']
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			}
		})
	]
});
