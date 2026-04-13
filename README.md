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
Desde la propia UI ya puedes pegar la URL del calendario y lanzar la sincronización.

2. Si prefieres consola, flujo completo desde la URL del calendario:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-all https://www.basquetcatala.cat/partits/calendari_equip_global/24/81178
```

Eso:

- crea o actualiza `match_mapping.json`
- descarga `stats` y `moves`
- genera `analysis.json`
- guarda los crudos en `BarnaStats/out/teams/{teamCalendarId}/...`

Si quieres ejecutar pasos sueltos, también puedes:

Crear o actualizar `match_mapping.json`:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings https://www.basquetcatala.cat/partits/calendari_equip_global/24/81178
```

Si ya tienes `matchWebId` y solo quieres resolver o reintentar IDs concretos:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings 70001 70002
```

Si ya existe la carpeta del equipo y quieres reusar ese contexto:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-all --team 81178 --all
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
