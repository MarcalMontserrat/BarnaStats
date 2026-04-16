import {CLUB_BRANDING_CATALOG} from "../data/clubBrandingCatalog.generated.js";
import {TEAM_CLUB_MAP} from "../data/teamClubMap.generated.js";

const FALLBACK_PALETTES = [
    {
        background: "linear-gradient(135deg, #163252 0%, #284f78 100%)",
        borderColor: "rgba(255, 255, 255, 0.18)",
        color: "#f9f4eb",
        shadow: "0 14px 28px rgba(22, 50, 82, 0.22)"
    },
    {
        background: "linear-gradient(135deg, #7f2f1d 0%, #bb5238 100%)",
        borderColor: "rgba(255, 255, 255, 0.16)",
        color: "#fff5ea",
        shadow: "0 14px 28px rgba(127, 47, 29, 0.22)"
    },
    {
        background: "linear-gradient(135deg, #1f4a3e 0%, #3c7b5e 100%)",
        borderColor: "rgba(255, 255, 255, 0.16)",
        color: "#f4fff8",
        shadow: "0 14px 28px rgba(31, 74, 62, 0.22)"
    },
    {
        background: "linear-gradient(135deg, #4c296f 0%, #7b54a8 100%)",
        borderColor: "rgba(255, 255, 255, 0.16)",
        color: "#faf4ff",
        shadow: "0 14px 28px rgba(76, 41, 111, 0.22)"
    },
    {
        background: "linear-gradient(135deg, #5c3d16 0%, #8e6533 100%)",
        borderColor: "rgba(255, 255, 255, 0.16)",
        color: "#fff9ef",
        shadow: "0 14px 28px rgba(92, 61, 22, 0.2)"
    }
];

const STOP_WORDS = new Set([
    "A",
    "AE",
    "ASSOCIACIO",
    "ATENEU",
    "BASQUET",
    "BASQUETBOL",
    "BASKET",
    "BC",
    "B.C",
    "C",
    "CB",
    "C.B",
    "CE",
    "C.E",
    "CLUB",
    "ESCOLA",
    "FC",
    "FEMENI",
    "MASCULI",
    "S.A.E",
    "SAE"
]);

const CLUB_BRANDING_BY_KEY = Object.fromEntries(
    CLUB_BRANDING_CATALOG.map((entry) => [entry.clubKey, entry])
);

function normalizeText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();
}

function hashString(value) {
    return [...String(value ?? "")].reduce((hash, char) => {
        return ((hash * 31) + char.charCodeAt(0)) >>> 0;
    }, 7);
}

function parseColor(value) {
    const raw = String(value ?? "").trim();
    if (!raw) {
        return "";
    }

    if (/^#[0-9a-f]{3}$/i.test(raw) || /^#[0-9a-f]{6}$/i.test(raw)) {
        return raw;
    }

    if (/^rgb(a)?\(/i.test(raw)) {
        return raw;
    }

    const parts = raw.split(",").map((segment) => Number(segment.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every((part) => Number.isFinite(part) && part >= 0 && part <= 255)) {
        return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
    }

    return "";
}

function buildPalette(teamColor, seed) {
    const parsedColor = parseColor(teamColor);
    if (parsedColor) {
        return {
            background: `linear-gradient(135deg, ${parsedColor} 0%, rgba(19, 32, 51, 0.92) 100%)`,
            borderColor: "rgba(255, 255, 255, 0.2)",
            color: "#fff8f0",
            shadow: "0 14px 28px rgba(19, 32, 51, 0.2)"
        };
    }

    return FALLBACK_PALETTES[hashString(seed) % FALLBACK_PALETTES.length];
}

function getInitials(teamName, teamShortName = "", clubShortName = "") {
    const normalizedShortName = normalizeText(clubShortName || teamShortName).replace(/[^A-Z0-9]/g, "");
    if (normalizedShortName.length >= 2 && normalizedShortName.length <= 4) {
        return normalizedShortName.slice(0, 3);
    }

    const tokens = normalizeText(teamName)
        .split(/\s+/)
        .filter(Boolean)
        .filter((token) => !STOP_WORDS.has(token))
        .filter((token) => /[A-Z]/.test(token));

    if (tokens.length >= 2) {
        return `${tokens[0][0]}${tokens[1][0]}`;
    }

    if (tokens.length === 1) {
        return tokens[0].slice(0, 2);
    }

    return normalizedShortName.slice(0, 2) || normalizeText(teamName).replace(/[^A-Z0-9]/g, "").slice(0, 2) || "EQ";
}

export function getClubBrandingForTeam(teamIdExtern) {
    const clubKey = TEAM_CLUB_MAP[String(teamIdExtern ?? "")];
    if (!clubKey) {
        return null;
    }

    return CLUB_BRANDING_BY_KEY[clubKey] ?? null;
}

export function resolveClubBranding({
    teamIdExtern,
    teamName,
    teamShortName = "",
    teamColor = ""
}) {
    const clubBranding = getClubBrandingForTeam(teamIdExtern);
    const seed = `${clubBranding?.clubKey || teamIdExtern || ""}|${teamName || ""}|${teamShortName || ""}`;
    const palette = buildPalette(teamColor, seed);

    return {
        clubKey: clubBranding?.clubKey ?? "",
        clubId: clubBranding?.clubId ?? 0,
        clubName: clubBranding?.clubName ?? "",
        clubShortName: clubBranding?.shortName ?? "",
        hasClubBranding: Boolean(clubBranding),
        initials: getInitials(teamName, teamShortName, clubBranding?.shortName ?? ""),
        logoSrc: clubBranding?.logoSrc ?? "",
        background: palette.background,
        borderColor: palette.borderColor,
        color: palette.color,
        shadow: palette.shadow
    };
}
