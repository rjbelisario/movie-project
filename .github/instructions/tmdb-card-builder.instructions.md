---
applyTo: "src/lib/components/**,src/routes/**/*.svelte,src/lib/types.ts"
description: Contrato de datos y reglas de diseño para UI basada en tarjetas de películas/series (grids, carruseles, listas).
---

# tmdb-card-builder

Instrucciones para construir o modificar UI basada en tarjetas (`CardItem[]`) en este
proyecto — resultados de búsqueda de TMDb, biblioteca del usuario, recomendaciones o
watchlist. Se apoyan en `data/contexto-biblioteca.json` como contrato de datos y en los
componentes existentes bajo `src/lib/components/` para mantener consistencia visual y de
tipos en todo el frontend generado.

## Contrato de datos

Toda tarjeta consume el tipo `CardItem` (`src/lib/types.ts`), que unifica dos orígenes:

- Un resultado de búsqueda de TMDb (`src/lib/server/tmdb.ts`) — sin `id`/`status`/`rating`/`notes`,
  porque todavía no está guardado en la biblioteca del usuario.
- Un `LibraryItem` completo (`src/lib/server/db/schema.ts`, tabla `library_items`) ya persistido
  en SQLite.

Antes de generar o tocar una vista de tarjetas, lee `data/contexto-biblioteca.json` y
`data/CONTEXTO.md` para confirmar los nombres de campo (camelCase), los valores posibles de
`mediaType` (`movie`/`tv`) y `status` (`planned`/`completed` en el schema real — el JSON de
contexto incluye además `watching`/`dropped` como referencia de estados futuros), y el rango de
`rating` (1–5 o `null`). No inventes campos que no estén en ese contrato.

## Componentes disponibles (reutilizar, no reinventar)

- `MovieCard.svelte` — la tarjeta atómica. Soporta `dense` (solo poster + título superpuesto,
  para carruseles) y modo completo (poster, badge de tipo, badge de estado, género, rating en
  estrellas, notas). Acepta un snippet `actions` para botones contextuales (añadir a biblioteca,
  marcar visto, etc.).
- `CardGrid.svelte` — grid responsive (`2 → 5` columnas) para listados completos (biblioteca,
  resultados de búsqueda, descubrimiento). Maneja el estado vacío con `emptyMessage`.
- `CardRow.svelte` — carrusel horizontal de tarjetas `dense`, para secciones tipo "Continuar
  viendo" o "Recomendado para ti" dentro de una página con varias filas.

Genera una tarjeta o layout **nuevo** solo si ninguno de los tres cubre el caso; en ese caso,
sigue el mismo patrón (props tipadas con `CardItem`, `keyOf()` para la key del `#each`,
`posterUrl()` de `src/lib/tmdb-image.ts` para resolver el poster).

## Reglas de diseño

- Usa solo los tokens semánticos definidos en `src/routes/layout.css`
  (`bg-surface`, `text-text-primary`, `text-text-secondary`, `border-border`, `text-rating`,
  etc.) — nunca colores OKLCH ni hex sueltos en los componentes.
- Estado sin póster: placeholder de texto centrado, nunca una imagen rota.
- Badge de tipo (`Película`/`Serie`) siempre visible arriba-izquierda; badge de estado
  (si existe `item.status`) arriba-derecha.
- Rating en estrellas (`★`/`☆`) con `aria-label` describiendo el valor numérico — no debe
  depender solo del color.
- Toda lista de tarjetas necesita un `emptyMessage` en español acorde al contexto de la página
  (ej. "Tu biblioteca está vacía todavía", no un genérico "No hay resultados" fuera de lugar).

## Flujo recomendado

1. Lee `data/contexto-biblioteca.json` para confirmar la forma de los datos.
2. Decide `CardGrid` (listado principal) vs `CardRow` (fila secundaria/carrusel) vs tarjeta ad-hoc.
3. Conecta con la fuente real de datos en el `+page.server.ts` correspondiente (TMDb en vivo o
   `library_items` vía Drizzle) — el JSON de contexto es solo referencia de forma, nunca se
   importa en producción.
4. Reutiliza `posterUrl()`, `CardItem` y los componentes existentes antes de escribir nada nuevo.

Ver también el prompt file `.github/prompts/renderizar_tarjetas.prompt.md` (`/renderizar_tarjetas`
en Copilot Chat), que orquesta este flujo completo para crear una sección de tarjetas nueva de
punta a punta.
