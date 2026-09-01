---
mode: agent
description: Genera o actualiza una sección de tarjetas (grid o carrusel) para una ruta del proyecto, a partir del contrato de datos de la biblioteca.
tools: ['codebase', 'editFiles', 'search', 'runCommands']
---

Tu tarea: generar o actualizar una sección de tarjetas de películas/series para la
ruta o sección indicada por el usuario, usando la fuente de datos que indique
(`biblioteca`, `tmdb` o `recomendaciones`).

Sigue el flujo completo, sin pedir confirmación entre pasos salvo que algo sea ambiguo:

1. **Contexto de datos** — Lee `data/contexto-biblioteca.json` y `data/CONTEXTO.md` para
   confirmar los campos disponibles (`tmdbId`, `mediaType`, `title`, `posterPath`, `overview`,
   `releaseDate`, `genres`, `status`, `rating`, `notes`) y su forma exacta. Cruza esos campos
   contra `src/lib/types.ts` (`CardItem`) y `src/lib/server/db/schema.ts` (`library_items`) para
   no asumir nada que no exista en el schema real.

2. **Elegir layout** — Decide entre:
   - `CardGrid.svelte` si es un listado principal de la página (biblioteca, resultados de
     búsqueda, descubrimiento).
   - `CardRow.svelte` si es una fila secundaria dentro de una página con varias secciones
     (ej. "Continuar viendo", "Recomendado para ti").
   No dupliques lógica de `MovieCard.svelte`: extiende sus props si falta algún campo, no crees
   una tarjeta paralela.

3. **Fuente de datos real** — Conecta la sección a datos reales, nunca al JSON de contexto:
   - `biblioteca`: query a `library_items` vía Drizzle (`src/lib/server/db/`), filtrado por
     `userId` de la sesión.
   - `tmdb`: `src/lib/server/tmdb.ts` (búsqueda o descubrimiento).
   - `recomendaciones`: el motor de recomendaciones (`src/lib/server/recommendations/`) si ya
     existe, o TMDb `discover` como fallback.
   Implementa el `+page.server.ts` (o handler en `src/routes/api/`) correspondiente devolviendo
   `CardItem[]`.

4. **Página/sección Svelte** — Crea o edita el `+page.svelte` (o componente de sección)
   consumiendo esos datos, con un `emptyMessage` contextual y, si aplica, un snippet `actions`
   (añadir a biblioteca, marcar como visto, quitar) que llame a `src/routes/api/library/`.

5. **Estilo** — Usa exclusivamente los tokens semánticos de `src/routes/layout.css`
   (`bg-surface`, `text-text-primary`, `text-text-secondary`, `border-border`, `text-rating`).
   No introduzcas colores nuevos.

6. **Verificación** — Ejecuta `pnpm check` (o el comando de type-check del proyecto) y revisa
   que no queden tipos `any` ni campos inventados fuera del contrato de `CardItem`. Si algo falla,
   diagnostica y corrige tú mismo antes de reportar terminado (no dejes el error para revisión
   manual).

Aplica en todo momento las instrucciones de `.github/instructions/tmdb-card-builder.instructions.md`
como referencia de contrato de datos, componentes reutilizables y reglas de diseño.
