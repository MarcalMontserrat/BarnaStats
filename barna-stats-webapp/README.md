# BarnaStats Web

Dashboard React para explorar `analysis.json` y lanzar sincronizaciones de calendarios sin pasar por la consola.

## Arranque rápido

```bash
npm install
npm run dev:all
```

Esto levanta:

- la web en `http://localhost:5173`
- la API local en `http://127.0.0.1:5071`

## Scripts

- `npm run dev`: solo la web
- `npm run dev:api`: solo la API local
- `npm run dev:all`: web + API local
- `npm run build`: build del frontend
- `npm run lint`: lint del frontend

## Uso

1. Pega una URL tipo `https://www.basquetcatala.cat/partits/calendari_equip_global/24/81178`
2. Pulsa `Sincronizar equipo`
3. Si aparece captcha/login, resuélvelo en el navegador auxiliar que abre Playwright
4. Cuando termine, la web recarga `analysis.json` automáticamente
