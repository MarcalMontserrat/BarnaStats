# BarnaStats Web

Dashboard React para explorar `analysis.json` y lanzar sincronizaciones sin pasar por la consola.

## Arranque rápido

```bash
npm install
npm run dev:all
```

Esto levanta:

- la web en `http://localhost:5173`
- la API local en `http://127.0.0.1:5071`

Si quieres generar resúmenes automáticos de partido:

```bash
export BARNASTATS_ENABLE_AI_MATCH_REPORTS=true
export OPENAI_API_KEY=tu_api_key
export BARNASTATS_OPENAI_MODEL=gpt-4.1-mini
```

La app mostrará esos análisis justo debajo de la tabla del partido cuando el pipeline los haya generado.

## Scripts

- `npm run dev`: solo la web
- `npm run dev:api`: solo la API local
- `npm run dev:all`: web + API local
- `npm run build`: build del frontend
- `npm run lint`: lint del frontend

## Uso

1. Abre `http://localhost:5173/#/sync`
2. Pega una URL tipo `https://www.basquetcatala.cat/competicions/resultats/20855/0`
3. Pulsa `Cargar fase`
4. Si aparece captcha/login, resuélvelo en el navegador auxiliar que abre Playwright
5. Cuando termine, vuelve al dashboard en `#/`
