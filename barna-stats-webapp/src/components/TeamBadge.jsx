import {useState} from "react";
import {resolveClubBranding} from "../utils/clubBranding.js";

const SIZE_MAP = {
    xs: 24,
    sm: 32,
    md: 42,
    lg: 64,
    xl: 96
};

function TeamBadge({
    teamIdExtern = 0,
    teamName = "",
    teamShortName = "",
    teamColor = "",
    size = "md",
    title = "",
    className = "",
    style = {}
}) {
    const branding = resolveClubBranding({teamIdExtern, teamName, teamShortName, teamColor});
    const [failedLogoSrc, setFailedLogoSrc] = useState("");

    const dimension = SIZE_MAP[size] ?? SIZE_MAP.md;
    const logoPadding = Math.max(3, Math.round(dimension * 0.12));
    const imageSrc = branding.logoSrc && branding.logoSrc !== failedLogoSrc
        ? branding.logoSrc
        : "";

    return (
        <span
            title={title || teamName || branding.clubName || undefined}
            className={className || undefined}
            style={{
                width: dimension,
                height: dimension,
                minWidth: dimension,
                borderRadius: "28%",
                overflow: "hidden",
                display: "grid",
                placeItems: "center",
                background: branding.background,
                border: `1px solid ${branding.borderColor}`,
                boxShadow: branding.shadow,
                color: branding.color,
                ...style
            }}
        >
            {imageSrc ? (
                <img
                    src={imageSrc}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    onError={() => setFailedLogoSrc(imageSrc)}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        display: "block",
                        padding: logoPadding,
                        background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 242, 236, 0.98) 100%)"
                    }}
                />
            ) : (
                <span
                    aria-hidden="true"
                    style={{
                        fontFamily: "var(--font-display)",
                        fontSize: Math.max(11, Math.round(dimension * 0.34)),
                        lineHeight: 1,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        fontWeight: 900
                    }}
                >
                    {branding.initials}
                </span>
            )}
        </span>
    );
}

export default TeamBadge;
