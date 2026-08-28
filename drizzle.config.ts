import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	// dialect 'sqlite' usa un driver local-only y falla en silencio contra una DATABASE_URL
	// remota de Turso (libsql://...); 'turso' usa @libsql/client, el mismo driver que el ORM
	// en runtime, y funciona tanto con URLs remotas como con archivos locales (file:...).
	dialect: 'turso',
	dbCredentials: { url: process.env.DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN },
	verbose: true,
	strict: true
});
