# BarnaStats

Pipeline y dashboard para descargar, transformar y visualizar estadísticas de baloncesto por equipo y por fase de temporada.

## Qué hace

- Descarga estadísticas y eventos de partidos desde la fuente oficial.
- Genera un `analysis.json` consolidado por equipo.
- Muestra los datos en una app React con filtros por equipo y fase.

## Estructura

- `BarnaStats/`: descarga de datos crudos.
- `GenerateAnalisys/`: transformación y generación del análisis.
- `barna-stats-webapp/`: dashboard web.

## Flujo

1. Descargar datos:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj
```

2. Generar análisis:

```bash
dotnet run --project GenerateAnalisys/GenerateAnalisys.csproj
```

3. Levantar la web:

```bash
cd barna-stats-webapp
npm install
npm run dev
```

El análisis publicado para la web queda en `barna-stats-webapp/public/data/analysis.json`.
