#!/usr/bin/env python3
"""Reconstruye los stats crudos de una fase a partir de los datos web publicados en un commit.

Para cuando se pierden los crudos de `BarnaStats/out/phases/{fase}` y la fuente ya no los sirve
(p. ej. temporada pasada: basquetcatala muestra sus partidos como "descans" y msstats devuelve `{}`).

Los datos web de git (`barna-stats-webapp/public/data`) tienen, por partido, los equipos, el marcador,
las estadísticas de cada jugadora y los insights ya calculados. Con eso se rehace un `*_stats.json`
por partido que GenerateAnalisys procesa igual que el original:
- se marca con `recoveredFrom` para distinguirlo de un fichero descargado;
- lleva `recoveredInsightsByTeamIdIntern`, que el generador usa en lugar de recalcular los insights
  (sin jugadas no se pueden recalcular);
- las jugadas no se pueden recuperar: los `*_moves.json` vacíos o `{}` quedan como `[]`.

Uso (desde cualquier directorio):
    python3 scripts/recover-phase-from-web-data.py <commit> <faseId>            # simulación
    python3 scripts/recover-phase-from-web-data.py <commit> <faseId> --write    # escribe

Después, regenera y compara con el commit: la salida debería ser idéntica salvo `generatedAtUtc`.
    dotnet run --project GenerateAnalisys
    git diff --stat <commit> -- barna-stats-webapp/public/data

Por defecto nunca se pisa un stats descargado y válido (con equipos y sin `recoveredFrom`): solo se
escriben los que faltan, están vacíos o ya eran reconstruidos.

--force: sobrescribe TAMBIÉN los stats descargados válidos. Úsalo solo si sabes que un fichero
descargado está mal, porque degrada los datos crudos aunque la web siga saliendo igual:
- se pierde lo que la reconstrucción no copia: la línea temporal del marcador (`score`) y todas las
  estadísticas que la web no usa (rebotes, asistencias, tapones, cinco inicial, periodos...);
- los insights pasan a ser los guardados en el commit en vez de calcularse con las jugadas;
- si el commit es antiguo, se meten datos desfasados.
Las jugadas no se tocan con --force: solo se escribe `[]` donde ya estaban vacías.
Si es una temporada pasada, esos datos no se pueden volver a descargar: haz copia de la fase antes.
"""
import argparse
import json
import subprocess
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
WEB_DATA = "barna-stats-webapp/public/data"


def git_json(commit, path):
    raw = subprocess.check_output(["git", "-C", str(REPO), "show", f"{commit}:{WEB_DATA}/{path}"])
    return json.loads(raw)


def to_raw_time(iso):
    # Mismo formato que el `time` original de msstats, en hora local ("Oct 5, 2025 4:30:00 PM").
    d = datetime.fromisoformat(iso)
    return f"{d.strftime('%b')} {d.day}, {d.year} {int(d.strftime('%I'))}{d.strftime(':%M:%S %p')}"


def is_downloaded_stats(path):
    """True si el fichero existente es un stats descargado y válido (no hay que pisarlo)."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    return isinstance(data, dict) and len(data.get("teams") or []) >= 2 and not data.get("recoveredFrom")


def is_empty_payload(path):
    try:
        return path.read_text(encoding="utf-8").strip() in ("", "{}", "[]", "null")
    except OSError:
        return True


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("commit", help="commit con los datos web buenos (p. ej. eb35b61f)")
    parser.add_argument("phase", type=int, help="id de la fase (carpeta en BarnaStats/out/phases)")
    parser.add_argument("--write", action="store_true", help="escribe los ficheros (por defecto solo simula)")
    parser.add_argument("--force", action="store_true", help="sobrescribe también stats descargados válidos; degrada los crudos (ver cabecera del script)")
    args = parser.parse_args()

    phase_dir = REPO / "BarnaStats" / "out" / "phases" / str(args.phase)
    mapping_file = phase_dir / "match_mapping.json"
    if not mapping_file.exists():
        sys.exit(f"No existe {mapping_file}")

    uuid_by_id = {
        m["matchWebId"]: m["uuidMatch"]
        for m in json.loads(mapping_file.read_text(encoding="utf-8"))
        if m.get("uuidMatch")
    }

    summaries = defaultdict(list)
    players = defaultdict(lambda: defaultdict(list))
    for team in git_json(args.commit, "analysis.json")["teams"]:
        for summary in git_json(args.commit, team["matchesFile"]):
            if summary["matchWebId"] in uuid_by_id and summary.get("sourcePhaseId") == args.phase:
                summaries[summary["matchWebId"]].append(summary)
        for row in git_json(args.commit, team["playersFile"]):
            if row["matchWebId"] in uuid_by_id and row.get("sourcePhaseId") == args.phase:
                players[row["matchWebId"]][row["teamIdIntern"]].append(row)

    problems, skipped, candidates, moves_fixed = [], [], 0, 0

    def build_team(match_id, summary):
        team_players = players[match_id].get(summary["teamIdIntern"], [])
        points = sum(p["points"] for p in team_players)
        if points != summary["teamScore"]:
            problems.append(f"{match_id}/{summary['teamName']}: suma de puntos {points} != {summary['teamScore']}")
        return {
            "teamIdIntern": summary["teamIdIntern"],
            "teamIdExtern": summary["teamIdExtern"],
            "name": summary["teamName"],
            "data": {"score": summary["officialTeamScore"]},
            "players": [{
                "actorId": p["playerActorId"],
                "uuid": p["playerUuid"] or None,
                "name": p["playerName"],
                "dorsal": p["dorsal"],
                "timePlayed": p["minutes"],
                "inOut": p["plusMinus"],
                "data": {
                    "score": p["points"],
                    "valoration": p["valuation"],
                    "faults": p["fouls"],
                    "shotsOfOneSuccessful": p["ftMade"],
                    "shotsOfOneAttempted": p["ftAttempted"],
                    "shotsOfTwoSuccessful": p["twoMade"],
                    "shotsOfTwoAttempted": p["twoAttempted"],
                    "shotsOfThreeSuccessful": p["threeMade"],
                    "shotsOfThreeAttempted": p["threeAttempted"],
                },
            } for p in team_players],
        }

    for match_id, uuid in sorted(uuid_by_id.items()):
        rows = summaries.get(match_id, [])
        homes = [r for r in rows if r["isHome"]]
        aways = [r for r in rows if not r["isHome"]]
        if len(rows) != 2 or len(homes) != 1 or len(aways) != 1:
            problems.append(f"{match_id}: {len(rows)} filas de equipo en {args.commit}")
            continue

        home, away = homes[0], aways[0]
        if home["officialTeamScore"] != away["officialRivalScore"] or home["matchInternId"] != away["matchInternId"]:
            problems.append(f"{match_id}: filas de equipo incoherentes")
            continue

        stats_path = phase_dir / "stats" / f"{match_id}_{uuid}_stats.json"
        if is_downloaded_stats(stats_path) and not args.force:
            skipped.append(match_id)
            continue

        raw = {
            "recoveredFrom": f"web-data@{args.commit}",
            "idMatchIntern": home["matchInternId"],
            "idMatchExtern": home["matchExternId"],
            "time": to_raw_time(home["matchDate"]),
            "localId": home["teamIdIntern"],
            "visitId": away["teamIdIntern"],
            "score": [],
            "teams": [build_team(match_id, home), build_team(match_id, away)],
            "recoveredInsightsByTeamIdIntern": {str(r["teamIdIntern"]): r["insights"] for r in (home, away)},
        }

        candidates += 1
        moves_path = phase_dir / "moves" / f"{match_id}_{uuid}_moves.json"
        if args.write:
            stats_path.parent.mkdir(parents=True, exist_ok=True)
            stats_path.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
            if is_empty_payload(moves_path):
                moves_path.parent.mkdir(parents=True, exist_ok=True)
                moves_path.write_text("[]", encoding="utf-8")
                moves_fixed += 1

    total_rows = sum(len(v) for team_rows in players.values() for v in team_rows.values())
    print(f"Fase {args.phase} desde {args.commit}")
    print(f"  partidos en el mapping: {len(uuid_by_id)} · filas jugadora: {total_rows}")
    print(f"  omitidos (stats descargados válidos): {len(skipped)}")
    print(f"  {'escritos' if args.write else 'se escribirían'}: {candidates}"
          + (f" · moves puestos a []: {moves_fixed}" if args.write else ""))
    print(f"  problemas: {problems or 'ninguno'}")
    if problems:
        sys.exit(1)


if __name__ == "__main__":
    main()
