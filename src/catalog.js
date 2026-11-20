import { BW_FILMS } from "./data/films.js";
import { BW_DEVELOPERS } from "./data/developers.js";

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

const DEVELOPER_NAME_ALIASES = {
  "kodak xtol": "xtol",
  "kodak d 76": "d 76",
  "kodak hc 110": "hc 110",
  "kodak tmax developer": "tmax dev",
  "kodak tmax dev": "tmax dev",
  "kodak tmax rs": "tmax rs",
  "kodak dektol": "dektol",
  "kodak microdol x": "microdol x",
  "ilford id 11": "id 11",
  "ilford ilfotec lc29": "ilfotec lc29",
  "ilford ilfotec dd": "ilfotec dd",
  "ilford ilfotec dd x": "ilfotec dd x",
  "ilford ilfotec hc": "ilfotec hc",
  "ilford ilfotec rt rapid": "ilfotec rt rapid",
  "ilford ilfosol 3": "ilfosol 3",
  "ilford microphen": "microphen",
  "ilford perceptol": "perceptol",
  "ilford pq universal": "pq universal"
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

export function normalizeDeveloperName(name) {
  const cleaned = String(name || "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/\bt[\s-]*max\b/g, "tmax")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return DEVELOPER_NAME_ALIASES[cleaned] || cleaned;
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
      normalizedDeveloper: normalizeDeveloperName(recipe.developer),
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
        key: `film:${normalizedFilm}`,
        fullName: recipe.film,
        hasVerifiedRecipes: true
      });
    }
    byFilm.get(normalizedFilm).push(normalizedRecipe);
  });

  return { byFilm, filmEntries };
}

export const POPULAR_FILM_NAMES = [
  "Ilford HP5+",
  "Kodak Tri-X 400",
  "Ilford FP4+",
  "Kodak TMax 400",
  "Kodak TMax 100",
  "Ilford Delta 400 Pro",
  "Ilford Delta 100 Pro",
  "Ilford Delta 3200 Pro",
  "Ilford Pan F+",
  "Ilford XP2 Super",
  "Ilford Ortho Plus",
  "Ilford SFX 200",
  "Kentmere 400",
  "Kentmere 100",
  "Kentmere 200",
  "Kodak TMax P3200",
  "Fuji Neopan 100 Acros II",
  "Fomapan 400",
  "Fomapan 200",
  "Fomapan 100",
  "Foma Ortho 400",
  "Foma Retropan 320",
  "CineStill BwXX",
  "Eastman Double-X (5222)",
  "Rollei RPX 400",
  "Rollei RPX 100",
  "Rollei RPX 25",
  "Rollei Retro 400S",
  "Rollei Retro 80S",
  "Rollei Superpan 200",
  "Rollei Infrared IR400",
  "Rollei Ortho 25 Plus",
  "AgfaPhoto APX 400",
  "AgfaPhoto APX 100",
  "Adox CHS 100 II",
  "Adox CMS 20 II",
  "Adox HR-50",
  "Arista EDU Ultra 400",
  "Arista EDU Ultra 100",
  "Ferrania P30"
];

export const POPULAR_DEVELOPER_NAMES = [
  "D-76",
  "HC-110",
  "Rodinal",
  "Xtol",
  "ID-11",
  "Ilfotec DD-X",
  "Ilfotec HC",
  "Ilfotec LC29",
  "Ilfosol 3",
  "Microphen",
  "Perceptol",
  "TMax Dev",
  "TMax RS",
  "XT-3",
  "Adox FX-39 II",
  "Adox D-76",
  "Adox Adonal",
  "Atomal 49",
  "Adox HR-DEV",
  "Adotech IV",
  "Cinestill Df96 Monobath",
  "D-96",
  "Diafine",
  "Pyrocat-HD",
  "510-Pyro",
  "PMK",
  "Caffenol C",
  "Caffenol C-M",
  "Fomadon R09",
  "Fomadon Excel",
  "Fomadon LQN",
  "Bellini Euro HC",
  "Bellini Hydrofen",
  "Black/White & Green",
  "Eco Pro",
  "LegacyPro L-110",
  "Acufine",
  "D-23",
  "Dektol",
  "Sprint Standard"
];

const POPULAR_FILM_RANK = new Map(
  POPULAR_FILM_NAMES.map((name, index) => [normalizeFilmName(name), index])
);

const POPULAR_DEVELOPER_RANK = new Map(
  POPULAR_DEVELOPER_NAMES.map((name, index) => [normalizeDeveloperName(name), index])
);

export function buildFilmList(filmEntries = []) {
  const byNormalized = new Map();
  const curatedIsoByNormalized = new Map();

  for (const [filmName, defaultIso] of BW_FILMS) {
    curatedIsoByNormalized.set(normalizeFilmName(filmName), defaultIso);
  }

  for (const entry of filmEntries) {
    byNormalized.set(entry.normalized, {
      key: entry.key || `film:${entry.normalized}`,
      normalized: entry.normalized,
      fullName: entry.fullName,
      defaultIso: curatedIsoByNormalized.get(entry.normalized) ?? 400,
      hasVerifiedRecipes: true,
      popularRank: POPULAR_FILM_RANK.get(entry.normalized) ?? Infinity
    });
  }

  for (const [filmName, defaultIso] of BW_FILMS) {
    const normalized = normalizeFilmName(filmName);
    if (!byNormalized.has(normalized)) {
      byNormalized.set(normalized, {
        key: `film:${normalized}`,
        normalized,
        fullName: filmName,
        defaultIso,
        hasVerifiedRecipes: false,
        popularRank: POPULAR_FILM_RANK.get(normalized) ?? Infinity
      });
    }
  }

  return [...byNormalized.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function buildDeveloperList(catalogByFilm = new Map()) {
  const byNormalized = new Map();

  for (const recipes of catalogByFilm.values()) {
    for (const recipe of recipes) {
      const normalized = recipe.normalizedDeveloper || normalizeDeveloperName(recipe.developer);
      if (!byNormalized.has(normalized)) {
        byNormalized.set(normalized, {
          key: `dev:${normalized}`,
          normalized,
          name: recipe.developer,
          popularRank: POPULAR_DEVELOPER_RANK.get(normalized) ?? Infinity
        });
      }
    }
  }

  for (const devName of BW_DEVELOPERS) {
    const normalized = normalizeDeveloperName(devName);
    if (!byNormalized.has(normalized)) {
      byNormalized.set(normalized, {
        key: `dev:${normalized}`,
        normalized,
        name: devName,
        popularRank: POPULAR_DEVELOPER_RANK.get(normalized) ?? Infinity
      });
    }
  }

  return [...byNormalized.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getRecipesForFilm(film, catalogByFilm) {
  if (!film || !catalogByFilm) return [];
  const normalized = film.normalized || normalizeFilmName(film.fullName);
  return (catalogByFilm.get(normalized) || []).map((recipe) => ({
    ...recipe,
    filmKey: film.key
  }));
}
