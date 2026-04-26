import {useEffect, useState} from "react";
import {sortFilterOptions, sortFilterOptionsKeepingGlobalFirst} from "../utils/filterOptions.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5071";

export const GENDER_OPTIONS = sortFilterOptions([
    {value: "F", label: "Femenino"},
    {value: "M", label: "Masculino"}
]);

export const TERRITORY_OPTIONS = sortFilterOptionsKeepingGlobalFirst([
    {value: "0", label: "Todos los territorios"},
    {value: "1", label: "Catalunya"},
    {value: "2", label: "Barcelona"},
    {value: "3", label: "Girona"},
    {value: "4", label: "Lleida"},
    {value: "5", label: "Tarragona"},
    {value: "6", label: "Tot basquet"}
], (option) => String(option?.value ?? "") === "0");

export function buildResultsUrl(phaseId) {
    const normalizedPhaseId = String(phaseId ?? "").trim();
    if (!normalizedPhaseId) {
        return "";
    }

    return `https://www.basquetcatala.cat/competicions/resultats/${normalizedPhaseId}/0`;
}

export function useBasquetCatalaSourceBuilder(enabled, gender, territory, categoryId) {
    const [categories, setCategories] = useState([]);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [categoriesError, setCategoriesError] = useState("");
    const [phases, setPhases] = useState([]);
    const [phasesLoading, setPhasesLoading] = useState(false);
    const [phasesError, setPhasesError] = useState("");

    useEffect(() => {
        if (!enabled) {
            setCategories([]);
            setCategoriesLoading(false);
            setCategoriesError("");
            return undefined;
        }

        const controller = new AbortController();

        async function loadCategories() {
            setCategoriesLoading(true);
            setCategoriesError("");
            setCategories([]);

            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/basquetcatala/categories?gender=${encodeURIComponent(gender)}&territory=${encodeURIComponent(territory)}`,
                    {signal: controller.signal}
                );

                const hasJson = response.headers
                    .get("content-type")
                    ?.includes("application/json");
                const payload = hasJson ? await response.json() : null;

                if (!response.ok) {
                    throw new Error(payload?.detail ?? payload?.error ?? "No se pudieron cargar las categorías.");
                }

                setCategories(sortFilterOptions(Array.isArray(payload) ? payload : []));
            } catch (err) {
                if (controller.signal.aborted) {
                    return;
                }

                setCategoriesError(String(err));
            } finally {
                if (!controller.signal.aborted) {
                    setCategoriesLoading(false);
                }
            }
        }

        void loadCategories();

        return () => {
            controller.abort();
        };
    }, [enabled, gender, territory]);

    useEffect(() => {
        setPhases([]);
        setPhasesError("");

        if (!enabled || !categoryId) {
            setPhasesLoading(false);
            return undefined;
        }

        const controller = new AbortController();

        async function loadPhases() {
            setPhasesLoading(true);
            setPhasesError("");

            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/basquetcatala/phases?categoryId=${encodeURIComponent(categoryId)}&gender=${encodeURIComponent(gender)}&territory=${encodeURIComponent(territory)}`,
                    {signal: controller.signal}
                );

                const hasJson = response.headers
                    .get("content-type")
                    ?.includes("application/json");
                const payload = hasJson ? await response.json() : null;

                if (!response.ok) {
                    throw new Error(payload?.detail ?? payload?.error ?? "No se pudieron cargar las fases.");
                }

                setPhases(sortFilterOptions(Array.isArray(payload) ? payload : []));
            } catch (err) {
                if (controller.signal.aborted) {
                    return;
                }

                setPhasesError(String(err));
            } finally {
                if (!controller.signal.aborted) {
                    setPhasesLoading(false);
                }
            }
        }

        void loadPhases();

        return () => {
            controller.abort();
        };
    }, [enabled, categoryId, gender, territory]);

    return {
        categories,
        categoriesLoading,
        categoriesError,
        phases,
        phasesLoading,
        phasesError
    };
}
