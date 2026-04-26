import {CLUB_BRANDING_CATALOG} from "../data/clubBrandingCatalog.generated.js";
import {CLUB_LOGO_FILES} from "../data/clubLogoFiles.generated.js";
import {TEAM_CLUB_MAP} from "../data/teamClubMap.generated.js";
import supplementalClubBrandingData from "../data/clubBrandingSupplemental.json";

const APP_BASE_URL = String(import.meta.env.BASE_URL ?? "/");

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

const TEAM_SPLIT_REGEX = /\s+-\s+|\/|\||,|\(|\)/;
const TEAM_SUFFIX_REGEX = /\b(U\d{1,2}|PR[0-9A-Z]*|J[0-9A-Z]*|C[0-9A-Z]*|I[0-9A-Z]*|MINI|PREMINI|SOTS ?\d+)\b.*$/;
const DERIVED_SUFFIX_REGEX = /\b(U\d{1,2}|PR[0-9A-Z]*|J[0-9A-Z]*|C[0-9A-Z]*|I[0-9A-Z]*|SF|JF|CF|IF|1ER ANY|2N ANY|3ER ANY|MINI|PREMINI|SOTS ?\d+)\b.*$/i;
const DERIVED_TRAILING_VARIANT_REGEX = /(?:\s+|^)(A|B|C|D|VERMELL|VERMELLA|NEGRE|NEGRA|VERD|VERDA|GROC|GROGA|BLAU|BLAUA|LILA|TARONJA|ROSA|BLANC|BLANCA)\s*$/i;
const CLUB_MARKER_REGEX = /\b(AE|AB|BC|BF|CB|CE|UE|BASQUET|BASKET|JET|SESE|AESE|LLUISOS|MANYANET)\b/;

const STOP_WORDS = new Set([
    "A",
    "AB",
    "ADB",
    "AE",
    "AESE",
    "ANY",
    "ASSOCIACIO",
    "ATENEU",
    "B",
    "BASQUET",
    "BASQUETB",
    "BASQUETBOL",
    "BASKET",
    "BC",
    "B.C",
    "BF",
    "C",
    "CADET",
    "CB",
    "C.B",
    "CE",
    "C.E",
    "CLUB",
    "CLUBS",
    "D",
    "DE",
    "DEL",
    "EL",
    "ESCOLA",
    "ESPORTIVA",
    "FC",
    "FEMENI",
    "GROC",
    "GROGA",
    "I",
    "INFANTIL",
    "JET",
    "JUNIOR",
    "L",
    "LA",
    "LES",
    "LILA",
    "MASCULI",
    "MINI",
    "NEGRE",
    "NEGRA",
    "NIVELL",
    "PREMINI",
    "PROMOCIO",
    "QUARTA",
    "ROSA",
    "S.A.E",
    "SAE",
    "SEGONA",
    "SENIOR",
    "SESE",
    "TARONJA",
    "TERCERA",
    "U",
    "UE",
    "VERD",
    "VERDA",
    "VERMELL",
    "VERMELLA",
    "Y"
]);

const SUPPLEMENTAL_CLUB_BRANDING = supplementalClubBrandingData ?? {clubs: [], teamClubMap: {}};
const CLUB_BRANDING_ENTRIES = buildClubBrandingCatalog();
const EFFECTIVE_TEAM_CLUB_MAP = {
    ...TEAM_CLUB_MAP,
    ...(SUPPLEMENTAL_CLUB_BRANDING.teamClubMap ?? {})
};
const CLUB_BRANDING_BY_KEY = Object.fromEntries(
    CLUB_BRANDING_ENTRIES.map((entry) => [entry.clubKey, entry])
);
const CLUB_BRANDING_BY_ALIAS = buildClubBrandingByAlias();
const CLUB_SEARCH_ENTRIES = buildClubSearchEntries();
const UNIQUE_SINGLE_TOKEN_CLUB_KEYS = buildUniqueSingleTokenClubKeys();

function normalizeText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();
}

function resolvePublicAssetUrl(value) {
    const rawValue = String(value ?? "").trim();
    if (!rawValue) {
        return "";
    }

    if (/^(https?:)?\/\//i.test(rawValue) || rawValue.startsWith("data:")) {
        return rawValue;
    }

    const normalizedBase = APP_BASE_URL.endsWith("/") ? APP_BASE_URL : `${APP_BASE_URL}/`;
    const normalizedPath = rawValue.replace(/^\/+/, "");
    return `${normalizedBase}${normalizedPath}`;
}

function normalizeLookupKey(value) {
    return normalizeText(value)
        .replace(/[^A-Z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function buildClubBrandingCatalog() {
    const entriesByKey = new Map();

    for (const entry of [
        ...(Array.isArray(CLUB_BRANDING_CATALOG) ? CLUB_BRANDING_CATALOG : []),
        ...(Array.isArray(SUPPLEMENTAL_CLUB_BRANDING.clubs) ? SUPPLEMENTAL_CLUB_BRANDING.clubs : [])
    ]) {
        if (!entry?.clubKey) {
            continue;
        }

        if (!entriesByKey.has(entry.clubKey)) {
            entriesByKey.set(entry.clubKey, {
                ...entry,
                aliases: [...new Set((entry.aliases ?? []).filter(Boolean))]
            });
            continue;
        }

        const current = entriesByKey.get(entry.clubKey);
        entriesByKey.set(entry.clubKey, {
            ...current,
            clubId: current.clubId || entry.clubId || 0,
            clubName: current.clubName || entry.clubName || "",
            shortName: current.shortName || entry.shortName || "",
            aliases: [...new Set([...(current.aliases ?? []), ...(entry.aliases ?? [])].filter(Boolean))]
        });
    }

    return [...entriesByKey.values()];
}

function buildClubBrandingByAlias() {
    const aliasMap = new Map();

    for (const club of CLUB_BRANDING_ENTRIES) {
        const aliases = new Set([
            club.clubName,
            club.shortName,
            ...(club.aliases ?? [])
        ]);

        for (const alias of aliases) {
            const normalizedAlias = normalizeLookupKey(alias);
            if (normalizedAlias && !aliasMap.has(normalizedAlias)) {
                aliasMap.set(normalizedAlias, club);
            }
        }
    }

    return aliasMap;
}

function buildSignificantTokens(value) {
    return normalizeLookupKey(value)
        .split(/\s+/)
        .filter(Boolean)
        .filter((token) => token.length > 1)
        .filter((token) => !/^\d+$/.test(token))
        .filter((token) => !STOP_WORDS.has(token));
}

function buildClubSearchEntries() {
    const entries = [];

    for (const club of CLUB_BRANDING_ENTRIES) {
        for (const alias of new Set([club.clubName, club.shortName, ...(club.aliases ?? [])])) {
            const normalizedAlias = normalizeLookupKey(alias);
            if (!normalizedAlias) {
                continue;
            }

            entries.push({
                club,
                alias: normalizedAlias,
                tokens: [...new Set(buildSignificantTokens(alias))]
            });
        }
    }

    return entries;
}

function buildUniqueSingleTokenClubKeys() {
    const tokensToClubKeys = new Map();

    for (const entry of CLUB_SEARCH_ENTRIES) {
        if (entry.tokens.length !== 1) {
            continue;
        }

        const token = entry.tokens[0];
        if (!tokensToClubKeys.has(token)) {
            tokensToClubKeys.set(token, new Set());
        }

        tokensToClubKeys.get(token).add(entry.club.clubKey);
    }

    return tokensToClubKeys;
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

function buildLookupCandidates(teamName, teamShortName) {
    const rawCandidates = new Set([teamShortName, teamName]);
    const expandedCandidates = new Set();

    for (const rawValue of rawCandidates) {
        const value = String(rawValue ?? "").trim();
        if (!value) {
            continue;
        }

        expandedCandidates.add(value);

        for (const part of value.split(/\s+-\s+|\/|\||,|\(|\)/)) {
            if (part.trim()) {
                expandedCandidates.add(part.trim());
            }
        }
    }

    const candidates = new Set();

    for (const candidate of expandedCandidates) {
        const normalized = normalizeLookupKey(candidate);
        if (!normalized) {
            continue;
        }

        candidates.add(normalized);
        candidates.add(normalized.replace(/\b[A-Z]$/, "").trim());
        candidates.add(normalized.replace(TEAM_SUFFIX_REGEX, "").trim());
    }

    return [...candidates].filter(Boolean);
}

function getClubBrandingByAlias(teamName, teamShortName = "") {
    const candidates = buildLookupCandidates(teamName, teamShortName);
    let bestMatch = null;
    let bestScore = -1;

    for (const candidate of candidates) {
        const exactMatch = CLUB_BRANDING_BY_ALIAS.get(candidate);
        if (exactMatch) {
            return exactMatch;
        }

        for (const [alias, club] of CLUB_BRANDING_BY_ALIAS.entries()) {
            if (alias.length < 6) {
                continue;
            }

            if (candidate === alias || candidate.startsWith(`${alias} `) || alias.startsWith(`${candidate} `)) {
                if (alias.length > bestScore) {
                    bestMatch = club;
                    bestScore = alias.length;
                }
            }
        }
    }

    return bestMatch;
}

function getClubBrandingByTokens(teamName, teamShortName = "") {
    const teamTokens = [...new Set(buildLookupCandidates(teamName, teamShortName).flatMap(buildSignificantTokens))];
    if (!teamTokens.length) {
        return null;
    }

    let bestMatch = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestOverlapCount = -1;
    let bestAliasTokenCount = -1;

    for (const entry of CLUB_SEARCH_ENTRIES) {
        if (!entry.tokens.length) {
            continue;
        }

        const overlapTokens = [...new Set(entry.tokens.filter((token) => teamTokens.includes(token)))];
        if (!overlapTokens.length) {
            continue;
        }

        const allAliasTokensInTeam = entry.tokens.every((token) => teamTokens.includes(token));
        const coverageAlias = overlapTokens.length / entry.tokens.length;
        const coverageTeam = overlapTokens.length / teamTokens.length;
        const hasUniqueSingleTokenMatch = overlapTokens.length === 1
            && entry.tokens.length === 1
            && overlapTokens[0].length >= 7
            && UNIQUE_SINGLE_TOKEN_CLUB_KEYS.get(overlapTokens[0])?.size === 1
            && !teamTokens.some((token) => token.length >= 4 && !entry.tokens.includes(token));
        const strongMatch = (overlapTokens.length >= 2 && allAliasTokensInTeam)
            || (overlapTokens.length >= 2 && coverageAlias >= 0.75 && coverageTeam >= 0.4)
            || hasUniqueSingleTokenMatch;
        if (!strongMatch) {
            continue;
        }

        const overlapLength = overlapTokens.reduce((total, token) => total + token.length, 0);
        const score = (allAliasTokensInTeam ? 100 : 0)
            + (overlapTokens.length * 20)
            + overlapLength
            + Math.round(coverageAlias * 10)
            + Math.round(coverageTeam * 5)
            - entry.tokens.length;

        if (score > bestScore
            || (score === bestScore && overlapTokens.length > bestOverlapCount)
            || (score === bestScore && overlapTokens.length === bestOverlapCount && entry.tokens.length > bestAliasTokenCount)) {
            bestMatch = entry.club;
            bestScore = score;
            bestOverlapCount = overlapTokens.length;
            bestAliasTokenCount = entry.tokens.length;
        }
    }

    return bestMatch;
}

function scoreDerivedClubPart(value) {
    const normalized = normalizeLookupKey(value);
    if (!normalized) {
        return 0;
    }

    const tokens = buildSignificantTokens(normalized);
    return (CLUB_MARKER_REGEX.test(normalized) ? 25 : 0)
        + (tokens.length * 8)
        + tokens.reduce((total, token) => total + Math.min(token.length, 10), 0)
        + Math.min(normalized.length, 20);
}

function buildDerivedClubLabel(teamName) {
    const rawParts = String(teamName ?? "")
        .split(TEAM_SPLIT_REGEX)
        .map((part) => String(part ?? "").trim())
        .filter(Boolean);
    if (!rawParts.length) {
        return String(teamName ?? "").trim();
    }

    const bestPart = [...rawParts].sort((left, right) => {
        const scoreDiff = scoreDerivedClubPart(right) - scoreDerivedClubPart(left);
        if (scoreDiff !== 0) {
            return scoreDiff;
        }

        return right.length - left.length;
    })[0];

    let cleaned = bestPart;
    while (cleaned) {
        const next = cleaned
            .replace(DERIVED_SUFFIX_REGEX, "")
            .replace(DERIVED_TRAILING_VARIANT_REGEX, "")
            .trim()
            .replace(/[-/|]+$/g, "")
            .trim();
        if (next === cleaned) {
            break;
        }

        cleaned = next;
    }

    return cleaned || bestPart;
}

function buildDerivedClubBranding(teamName) {
    const clubName = buildDerivedClubLabel(teamName);
    const normalizedKey = normalizeLookupKey(clubName) || "EQUIPO";

    return {
        clubKey: `derived-club:${normalizedKey.toLowerCase().replace(/\s+/g, "-")}`,
        clubId: 0,
        clubName: clubName || String(teamName ?? "").trim(),
        shortName: clubName || String(teamName ?? "").trim(),
        aliases: [clubName || String(teamName ?? "").trim()],
        isSynthetic: true
    };
}

function getClubBrandingByName(teamName, teamShortName = "") {
    return getClubBrandingByAlias(teamName, teamShortName)
        ?? getClubBrandingByTokens(teamName, teamShortName)
        ?? buildDerivedClubBranding(teamName);
}

export function getClubBrandingForTeam(teamIdExtern, teamName = "", teamShortName = "") {
    const clubKey = EFFECTIVE_TEAM_CLUB_MAP[String(teamIdExtern ?? "")];
    if (clubKey) {
        return CLUB_BRANDING_BY_KEY[clubKey] ?? null;
    }

    return getClubBrandingByName(teamName, teamShortName);
}

export function resolveClubBranding({
    teamIdExtern,
    teamName,
    teamShortName = "",
    teamColor = ""
}) {
    const clubBranding = getClubBrandingForTeam(teamIdExtern, teamName, teamShortName);
    const seed = `${clubBranding?.clubKey || teamIdExtern || ""}|${teamName || ""}|${teamShortName || ""}`;
    const palette = buildPalette(teamColor, seed);

    return {
        clubKey: clubBranding?.clubKey ?? "",
        clubId: clubBranding?.clubId ?? 0,
        clubName: clubBranding?.clubName ?? "",
        clubShortName: clubBranding?.shortName ?? "",
        hasClubBranding: Boolean(clubBranding),
        initials: getInitials(teamName, teamShortName, clubBranding?.shortName ?? ""),
        logoSrc: resolvePublicAssetUrl((clubBranding && CLUB_LOGO_FILES[clubBranding.clubKey]) || clubBranding?.logoSrc || ""),
        background: palette.background,
        borderColor: palette.borderColor,
        color: palette.color,
        shadow: palette.shadow
    };
}
