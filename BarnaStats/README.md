Este programa descarga las estadísticas crudas de partido y jugadoras.
Su responsabilidad es la ingesta y la orquestación básica del pipeline:

- resolver `matchWebId -> uuidMatch`
- descargar JSON de `stats`
- descargar JSON de `moves`
- lanzar `GenerateAnalisys` para regenerar `analysis.json`

Cuando trabajas con varios equipos, cada calendario queda aislado en su propia carpeta:

```text
BarnaStats/out/teams/{teamCalendarId}/match_mapping.json
BarnaStats/out/teams/{teamCalendarId}/stats
BarnaStats/out/teams/{teamCalendarId}/moves
```

## Flujos

### 1. Resolver `uuid` de partidos

Para evitar el paso manual de pegar JavaScript en la consola del navegador, existe un modo semiautomático:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings
```

Qué hace:

- abre un navegador real con sesión persistente
- te deja resolver captcha/login si hace falta
- recorre los `matchWebId` pendientes
- actualiza `match_mapping.json`

Si partes solo de la URL del calendario del equipo, también puede descubrir los `matchWebId` por ti:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings https://www.basquetcatala.cat/partits/calendari_equip_global/24/81178
```

Qué hace en ese caso:

- abre el calendario del equipo en el navegador real
- reutiliza tu sesión para pasar captcha/login
- extrae los `matchWebId` desde el HTML cargado
- resuelve los `uuidMatch`
- crea o completa `match_mapping.json`

Si ya has sincronizado ese equipo una vez, también puedes apuntar directamente a su carpeta:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings --team 81178 --all
```

También puedes forzar IDs concretos:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings 70001 70002
```

O reintentar todos:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings --all
```

O releer el calendario y reintentar todos los partidos encontrados:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings --calendar https://www.basquetcatala.cat/partits/calendari_equip_global/24/81178 --all
```

Si quieres lanzarlo desde la API local o desde un proceso sin terminal, usa el modo no interactivo:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-all --non-interactive https://www.basquetcatala.cat/partits/calendari_equip_global/24/81178
```

## Resumenes AI por partido

`GenerateAnalisys` puede pedir a OpenAI un resumen neutral de cada partido y dejarlo cacheado.

Variables:

```bash
export BARNASTATS_ENABLE_AI_MATCH_REPORTS=true
export OPENAI_API_KEY=tu_api_key
export BARNASTATS_OPENAI_MODEL=gpt-4.1-mini
```

Comportamiento:

- por defecto esta feature esta desactivada
- solo llama a OpenAI cuando falta el resumen o cambian `stats`/`moves`
- reutiliza la caché si los datos siguen iguales
- guarda la caché en `BarnaStats/out/match-reports`
- si no hay `OPENAI_API_KEY`, el pipeline sigue funcionando y simplemente omite esos resúmenes

### 2. Descargar stats y moves

```bash
dotnet run --project BarnaStats/BarnaStats.csproj
```

El output se guarda en `out/stats` y `out/moves`.

### 3. Generar análisis

Después hay que ejecutar `GenerateAnalisys` para producir el `analysis.json` consumido por la web.

### 4. Ejecutarlo todo del tirón

Si quieres hacer el flujo completo partiendo de la URL del calendario:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-all https://www.basquetcatala.cat/partits/calendari_equip_global/24/81178
```

Qué hace:

- sincroniza o crea `match_mapping.json`
- descarga `stats` y `moves`
- ejecuta `GenerateAnalisys`
- deja actualizado `BarnaStats/out/analysis.json`
- deja actualizada la copia de la web en `barna-stats-webapp/public/data/analysis.json`

Si ya existe la carpeta del equipo:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-all --team 81178 --all
```
