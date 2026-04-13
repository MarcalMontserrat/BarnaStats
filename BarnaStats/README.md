Este programa descarga las estadísticas crudas de partido y jugadoras.
Su responsabilidad es solo la ingesta:

- resolver `matchWebId -> uuidMatch`
- descargar JSON de `stats`
- descargar JSON de `moves`

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

También puedes forzar IDs concretos:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings 70001 70002
```

O reintentar todos:

```bash
dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings --all
```

### 2. Descargar stats y moves

```bash
dotnet run --project BarnaStats/BarnaStats.csproj
```

El output se guarda en `out/stats` y `out/moves`.

### 3. Generar análisis

Después hay que ejecutar `GenerateAnalisys` para producir el `analysis.json` consumido por la web.
