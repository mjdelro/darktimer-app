const CATALOG_URL = "./data/recipes.json";

const FILM_NAME_ALIASES = {
  "fuji neopan 100ss": "fuji neopan ss",
  "kentmere 100": "kentmere pan 100",
  "kentmere 200": "kentmere pan 200",
  "kentmere 400": "kentmere pan 400",
  "fomapan 100": "fomapan 100 classic",
  "fomapan 400": "fomapan 400 action",
  "foma retropan 320": "foma retropan 320 soft",
  "kodak plus x": "kodak plus x pan",
  "rollei infrared ir400": "rollei infrared 400",
  "rollei paul reinhold 640": "rollei paul reinhold",
  "lomography orca 110": "lomography orca",
  "silberra pan ultima 100": "silberra ultima 100",
  "silberra pan ultima 160": "silberra pan 160 ultima 160",
  "silberra pan ultima 200": "silberra pan 200 ultima 200",
  "holga 400": "foma holga 400"
};

export function normalizeFilmName(name) {
  const cleaned = String(name || "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/\bfujifilm\b/g, "fuji")
    .replace(/\bt[\s-]*max\b/g, "tmax")
    .replace(/\borta\s*50\b/g, "orta 50")
    .replace(/^film\s+ferrania\b/, "ferrania")
    .replace(/\b(professional|pro)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return FILM_NAME_ALIASES[cleaned] || cleaned;
}

export async function loadCustomCatalog() {
  const response = await fetch(CATALOG_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Catalog request failed with HTTP ${response.status}`);

  const data = await response.json();
  if (!Array.isArray(data.recipes)) throw new Error("Recipe catalog is malformed");

  const sources = new Map((data.sources || []).map((source) => [source.id, source]));
  const byFilm = new Map();
  const filmEntries = [];

  data.recipes.forEach((recipe, index) => {
    const source = sources.get(recipe.sourceId);
    if (!source) throw new Error(`Recipe ${index + 1} refers to an unknown source`);

    const normalizedRecipe = {
      ...recipe,
      id: `verified-${index}`,
      temperatureC: Number(recipe.temperatureC) || 20,
      ei: Number.isFinite(Number(recipe.ei)) ? Number(recipe.ei) : null,
      format: recipe.format || "any",
      sourceTitle: source.title,
      sourceUrl: source.url,
      retrievedAt: source.retrievedAt,
      isCustom: false
    };
    const normalizedFilm = normalizeFilmName(recipe.film);

    if (!byFilm.has(normalizedFilm)) {
      byFilm.set(normalizedFilm, []);
      filmEntries.push({
        normalized: normalizedFilm,
        key: `verified:${normalizedFilm}`,
        fullName: recipe.film,
        isCustomOnly: false
      });
    }
    byFilm.get(normalizedFilm).push(normalizedRecipe);
  });

  return { byFilm, filmEntries };
}

export async function loadFilmList(filmEntries) {
  const films = filmEntries
    .map((entry) => ({ key: entry.key, fullName: entry.fullName, isCustomOnly: false }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  return { mode: "local", films };
}

export async function loadRecipesForFilm(film, catalogByFilm) {
  if (!film) return [];
  return (catalogByFilm.get(normalizeFilmName(film.fullName)) || []).map((recipe) => ({
    ...recipe,
    filmKey: film.key
  }));
}
