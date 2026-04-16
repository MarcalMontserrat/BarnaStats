import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {CLUB_BRANDING_CATALOG} from "../src/data/clubBrandingCatalog.generated.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, "..", "public", "team-logos", "fcbq-clubs");
const MANIFEST_FILE = path.join(__dirname, "..", "src", "data", "clubLogoFiles.generated.js");

function getExtensionFromContentType(contentType) {
    const normalized = String(contentType ?? "").toLowerCase();
    if (normalized.includes("image/png")) {
        return ".png";
    }

    if (normalized.includes("image/svg")) {
        return ".svg";
    }

    if (normalized.includes("image/webp")) {
        return ".webp";
    }

    if (normalized.includes("image/gif")) {
        return ".gif";
    }

    return ".jpg";
}

function getExtensionFromUrl(value) {
    const pathname = new URL(value).pathname.toLowerCase();
    if (pathname.endsWith(".png")) {
        return ".png";
    }

    if (pathname.endsWith(".svg")) {
        return ".svg";
    }

    if (pathname.endsWith(".webp")) {
        return ".webp";
    }

    if (pathname.endsWith(".gif")) {
        return ".gif";
    }

    if (pathname.endsWith(".jpeg")) {
        return ".jpeg";
    }

    if (pathname.endsWith(".jpg")) {
        return ".jpg";
    }

    return "";
}

async function ensureDirectory(directoryPath) {
    await fs.mkdir(directoryPath, {recursive: true});
}

async function localizeLogo(club) {
    if (!club.logoSrc || !/^https?:\/\//i.test(club.logoSrc)) {
        return null;
    }

    const response = await fetch(club.logoSrc);
    if (!response.ok) {
        throw new Error(`Failed to download logo for ${club.clubKey}: ${response.status}`);
    }

    const extension = getExtensionFromUrl(club.logoSrc) || getExtensionFromContentType(response.headers.get("content-type"));
    const fileName = `${club.clubId}${extension}`;
    const outputPath = path.join(OUTPUT_DIR, fileName);
    const buffer = Buffer.from(await response.arrayBuffer());

    await fs.writeFile(outputPath, buffer);

    return `team-logos/fcbq-clubs/${fileName}`;
}

async function main() {
    await ensureDirectory(OUTPUT_DIR);

    const manifest = {};

    for (const club of CLUB_BRANDING_CATALOG) {
        if (!club.logoSrc) {
            continue;
        }

        const localPath = await localizeLogo(club);
        if (localPath) {
            manifest[club.clubKey] = localPath;
        }
    }

    const fileContents = `${[
        "export const CLUB_LOGO_FILES = ",
        JSON.stringify(manifest, null, 2),
        ";\n"
    ].join("")}`;

    await fs.writeFile(MANIFEST_FILE, fileContents);

    console.log(`localized ${Object.keys(manifest).length} club logos`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
