# Mi Biblioteca

Tracker personal de películas y series conectado a [TMDb](https://www.themoviedb.org/), con
watchlist, historial de vistos, seguimiento por episodio, estadísticas, filtros de
descubrimiento, sincronización opcional con [Trakt.tv](https://trakt.tv) y un motor de
recomendaciones propio (contenido + filtrado colaborativo). Multiusuario, con cuentas y sesiones
propias.

Proyecto final del curso **Desarrollo con Inteligencia Artificial** — construido con SvelteKit,
Drizzle ORM sobre SQLite (libSQL) y la API de TMDb.

## Funcionalidades

- **Descubrimiento**: inicio con tendencias, populares y próximos estrenos (TMDb); búsqueda por
  texto y un panel de filtros avanzados (tipo, géneros combinables, rango de años, calificación
  mínima, orden) que arma una consulta `/discover` de TMDb.
- **Ficha de título**: hero con backdrop, póster, director/creador, reparto, tráiler, géneros
  clicables (filtran `/buscar`) y títulos similares.
- **Biblioteca personal**: Watchlist (pendientes) y Vistos (historial) como secciones propias,
  más una vista general filtrable. Rating y notas solo tienen sentido — y solo se muestran —
  una vez marcado un título como visto.
- **Seguimiento por episodio**: temporada por temporada, con progreso agregado por serie.
- **Estadísticas**: totales, distribución por estado/tipo, géneros más frecuentes.
- **Recomendaciones**: motor híbrido propio (perfil de gusto por contenido + filtrado
  colaborativo por factorización de matrices) — ver [Motor de recomendaciones](#motor-de-recomendaciones).
- **Sincronización con Trakt.tv**: importa watchlist e historial (incluido progreso por
  episodio) desde una cuenta de Trakt conectada, sin pisar ratings/notas propios.
- **Cuentas de usuario**: registro/login con sesiones propias; cada biblioteca es privada por
  usuario.

## Stack técnico

- **SvelteKit** (Svelte 5, TypeScript) + **Tailwind CSS v4**.
- **Drizzle ORM** sobre **libSQL** (SQLite): archivo local en desarrollo, [Turso](https://turso.tech)
  en producción — mismo driver y esquema en ambos entornos.
- **TMDb API v3** consumida solo server-side (`src/lib/server/tmdb.ts`), nunca se expone la key
  al cliente.
- Autenticación propia (sin librerías externas): `scrypt` + sesiones por cookie httpOnly
  (`src/lib/server/auth.ts`, `src/hooks.server.ts`).
- Integración OAuth con Trakt.tv (`src/lib/server/trakt.ts`, `traktAccount.ts`, `traktSync.ts`).
- Motor de recomendaciones propio en `src/lib/server/recommendations/`, con factorización de
  matrices (`matrixFactorization.ts`) entrenada en un `worker_thread` aparte.
- Despliegue objetivo: contenedor Docker autogestionado vía [Dokploy](https://dokploy.com)
  (`@sveltejs/adapter-node`).

## Motor de recomendaciones

Híbrido **content-based + collaborative filtering**:

1. **Perfil de gusto** (`tasteProfile.ts`): a partir de los títulos que el usuario marcó como
   vistos y calificó, construye afinidades por género, década, país, reparto, director y
   keywords, ponderadas por rating y con decaimiento por antigüedad.
2. **Candidatos** (`candidates.ts`): TMDb `similar`/`recommendations` de los títulos mejor
   calificados, más `discover` por géneros/keywords dominantes.
3. **Scoring** (`scoring.ts`): dos pasadas (coarse → fine) combinando las señales del perfil con
   un prior bayesiano de calidad, más diversidad tipo MMR y una cuota de exploración.
4. **Filtrado colaborativo** (`matrixFactorization.ts`, `collaborativeFiltering.ts`): FunkSVD
   (bias global + por usuario/ítem + factores latentes, SGD) entrenado sobre los ratings de
   *todos* los usuarios de la app más una semilla de [MovieLens](https://grouplens.org/datasets/movielens/)
   para el cold-start. Se mezcla con el score de contenido, con más peso cuanto más historial
   tiene el usuario.
5. Todo se cachea en memoria por proceso (resultado por usuario ~12 min, modelo CF ~45 min) y se
   invalida al sincronizar con Trakt o al pedir "actualizar" desde `/recomendaciones`.

El dataset MovieLens bundleado es una muestra pequeña (~100K ratings). Para el dataset completo
(~34M ratings, mejor calidad de recomendación), correr una vez:

```sh
pnpm run data:movielens
```

## Puesta en marcha

### 1. Variables de entorno

Copiar `.env.example` a `.env` y completar:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | `file:local.db` en local; URL de Turso en producción. |
| `DATABASE_AUTH_TOKEN` | Token de Turso (solo producción, vacío en local). |
| `TMDB_API_KEY` | API key v3 de [TMDb](https://www.themoviedb.org/settings/api). |
| `TRAKT_CLIENT_ID` / `TRAKT_CLIENT_SECRET` | App OAuth en [trakt.tv/oauth/applications](https://trakt.tv/oauth/applications). Redirect URI a registrar: `<origen>/api/trakt/callback` (`http://localhost:5173/api/trakt/callback` en dev). |

### 2. Instalar y migrar

```sh
pnpm install
pnpm run db:migrate
```

### 3. Desarrollo

```sh
pnpm run dev
```

### Scripts disponibles

| Script | Qué hace |
|---|---|
| `pnpm run dev` | Servidor de desarrollo. |
| `pnpm run build` / `pnpm run preview` | Build de producción / previsualizarlo. |
| `pnpm run check` | Type-check (`svelte-check`). |
| `pnpm run db:generate` / `db:migrate` / `db:push` / `db:studio` | Flujo de migraciones Drizzle. |
| `pnpm run data:movielens` | Descarga el dataset MovieLens completo para mejores recomendaciones (opcional, ~400MB, no se commitea). |

## Despliegue

1. Crear la base en Turso y aplicar el esquema:
   ```sh
   turso auth login
   turso db create mi-biblioteca
   turso db show mi-biblioteca --url
   turso db tokens create mi-biblioteca
   ```
2. En Dokploy, crear una aplicación de tipo Dockerfile apuntando a este repo (usa el
   [Dockerfile](Dockerfile) del root; no requiere configuración de build adicional).
3. Configurar `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `TMDB_API_KEY`, `TRAKT_CLIENT_ID` y
   `TRAKT_CLIENT_SECRET` como variables de entorno de la aplicación en Dokploy (ver
   [.env.example](.env.example)).
4. Registrar `https://<dominio-de-producción>/api/trakt/callback` como redirect URI en la app
   de Trakt.
5. Desplegar. El contenedor expone el puerto `3010` y responde `200 ok` en `/health` (usado por
   el `HEALTHCHECK` de Docker y se puede reusar como health check path en Dokploy). El esquema
   de la base se aplica aparte con `pnpm run db:push` contra la `DATABASE_URL` de Turso, no
   corre automáticamente al arrancar el contenedor.

El [docker-compose.yml](docker-compose.yml) no publica el puerto al host a propósito (`expose`,
no `ports`) — en Dokploy el proxy Traefik interno enruta directo al contenedor por su red, y
publicar el puerto ahí puede chocar con otras apps del mismo servidor. Para levantarlo localmente
y poder entrar por `localhost:3010`, agregar el mapeo al vuelo:
`docker compose run --rm --service-ports app` (o correr `docker build -t movie-project . && docker run --env-file .env -p 3010:3010 movie-project` directamente).

## Estructura del proyecto

```
src/lib/server/
  tmdb.ts                 Cliente TMDb (búsqueda, descubrimiento, detalle, créditos, temporadas)
  library.ts               CRUD de biblioteca + progreso por episodio + estadísticas
  auth.ts                  Sesiones y hashing de contraseñas
  trakt.ts / traktAccount.ts / traktSync.ts   OAuth e importación desde Trakt
  concurrency.ts           Límite de concurrencia para llamadas a TMDb
  recommendations/         Motor de recomendaciones (perfil, candidatos, scoring, CF)
  matrixFactorization.ts   Factorización de matrices (FunkSVD) para el filtrado colaborativo
src/routes/                Páginas y endpoints (SvelteKit file-based routing)
data/contexto-biblioteca.json   Contexto de datos de referencia (ver data/CONTEXTO.md)
.claude/skills/tmdb-card-builder, .claude/commands/renderizar_tarjetas.md
                            Skill + comando personalizado para generar la UI de tarjetas
.claude/agents/agente-datos-tmdb.md   Agente especializado en la capa de datos TMDb/biblioteca
```

## Cumplimiento de la rúbrica del curso

1. **Cero código manual** — todo el código se generó vía prompting/agentes.
2. **Contexto de datos** — `data/contexto-biblioteca.json` + `data/CONTEXTO.md`.
3. **Skill + comando personalizado** — skill `tmdb-card-builder`, comando `/renderizar_tarjetas`.
4. **Agente especializado** — `agente-datos-tmdb`, responsable de la capa TMDb/biblioteca.
5. **Depuración autónoma** — errores de SSR, tipos y reactividad diagnosticados y corregidos
   iterando con las herramientas de Claude Code durante el desarrollo (ver historial de commits).
6. **Despliegue** — ver [Despliegue](#despliegue).
