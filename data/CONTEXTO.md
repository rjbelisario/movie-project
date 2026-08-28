# Contexto de datos del proyecto

`contexto-biblioteca.json` es el archivo base exigido por la rúbrica del curso (regla 2:
"Integración de Contexto de Datos"). Contiene 12 registros de ejemplo con la **forma exacta**
de la tabla `library_items` (ver [`src/lib/server/db/schema.ts`](../src/lib/server/db/schema.ts))
tal como la expone la capa de datos: mismos nombres de campo en camelCase, mismos valores
posibles de `mediaType` (`movie`/`tv`) y `status` (`planned`/`watching`/`completed`/`dropped`),
y `rating` de 1 a 5 o `null`.

Los `posterPath` son valores plausibles con el formato real de TMDb (`/xxxx.jpg`), pero no se
consultaron contra la API — sirven solo como contexto estructural, no como datos reales de
producción. Los datos reales llegan en tiempo de ejecución desde TMDb vía
`src/lib/server/tmdb.ts`.

## Cómo se usó como contexto

Este archivo se referenció directamente en los prompts que generaron:

- El componente `MovieCard.svelte` y el grid de tarjetas (`/renderizar_tarjetas`, ver
  `.claude/commands/renderizar_tarjetas.md` y la skill `.claude/skills/tmdb-card-builder/`),
  para que el agente conociera de antemano qué campos mostrar (poster, título, género, estado,
  rating, notas) sin necesidad de adivinar la forma de los datos.
- La página de estadísticas (`/estadisticas`), para diseñar las agregaciones (conteo por
  género, distribución por estado, promedio de rating) sobre datos representativos antes de
  tener la base de datos poblada con contenido real.
- La página de detalle (`/titulo/[mediaType]/[id]`) y los controles de edición
  (`LibraryItemControls.svelte`), que combinan estos mismos campos con los datos en vivo de
  TMDb (`src/lib/server/tmdb.ts`) para mostrar/editar el estado de un título en la biblioteca.

Esto es lo que exige la rúbrica: el agente construyó la interfaz **a partir de** la estructura
de datos, no al revés.
