# BarnaStats

Pipeline y dashboard para descargar, transformar y visualizar estadísticas de baloncesto por equipo y por fase de temporada.

## Qué hace

- Descarga estadísticas y eventos de partidos desde la fuente oficial.
- Genera un `analysis.json` consolidado por equipo.
- Muestra los datos en una app React con filtros por equipo y fase.

## Estructura

- `BarnaStats/`: descarga de datos crudos.
- `BarnaStats.Api/`: API local para lanzar sincronizaciones desde la web.
- `GenerateAnalisys/`: transformación y generación del análisis.
- `barna-stats-webapp/`: dashboard web.

## Flujo

1. Levantar web + API local:

```bash
cd barna-stats-webapp
npm install
npm run dev:all
```

La web quedará en `http://localhost:5173` y la API local en `http://127.0.0.1:5071`.
Desde la propia UI ya puedes pegar la URL de resultados de una fase y lanzar la sincronización desde la página `#/sync`.

Si quieres activar resúmenes automáticos de partido con OpenAI, exporta antes:

```bash
export BARNASTATS_ENABLE_AI_MATCH_REPORTS=true
export OPENAI_API_KEY=tu_api_key
export BARNASTATS_OPENAI_MODEL=gpt-4.1-mini
```

La caché de esos resúmenes se guarda en `BarnaStats/out/match-reports`.

2. Si prefieres consola, flujo completo desde una URL de resultados por fase:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-all https://www.basquetcatala.cat/competicions/resultats/20855/0
```

Eso:

- crea o actualiza `match_mapping.json`
- descarga `stats` y `moves`
- genera `analysis.json`
- guarda los crudos en `BarnaStats/out/phases/{phaseId}/...`

Si quieres ejecutar pasos sueltos, también puedes:

Crear o actualizar `match_mapping.json`:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings https://www.basquetcatala.cat/competicions/resultats/20855/0
```

Si ya tienes `matchWebId` y solo quieres resolver o reintentar IDs concretos:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings 70001 70002
```

O si ya existe la carpeta de una fase:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-all --phase 20855 --all
```

3. Descargar stats y moves:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj
```

4. Generar análisis:

```bash
dotnet run --project GenerateAnalisys/GenerateAnalisys.csproj
```

El análisis publicado para la web queda en `barna-stats-webapp/public/data/analysis.json`.

## GitHub Pages

El repo queda preparado para publicar la parte web en GitHub Pages como sitio estático.

- El workflow está en `.github/workflows/deploy-pages.yml`.
- En Pages solo se publica la app React y los JSON generados de `barna-stats-webapp/public/data`.
- La parte de sincronización no aparece en GitHub Pages, porque allí no existe la API local ni el pipeline `.NET`.

Para que funcione bien al publicar:

- mantén commiteados `barna-stats-webapp/public/data/analysis.json`
- mantén commiteados `barna-stats-webapp/public/data/competition.json`
- mantén commiteado `barna-stats-webapp/public/data/teams/`

La ingesta y regeneración de datos sigue siendo local:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-all https://www.basquetcatala.cat/competicions/resultats/20855/0
dotnet run --project GenerateAnalisys/GenerateAnalisys.csproj
```
