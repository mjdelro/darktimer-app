import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDeveloperList,
  buildFilmList,
  getRecipesForFilm,
  normalizeDeveloperName,
  normalizeFilmName
} from "../src/catalog.js";
import { BW_FILMS } from "../src/data/films.js";
import { BW_DEVELOPERS } from "../src/data/developers.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.join(directory, "..", "public", "data");
const catalog = JSON.parse(fs.readFileSync(path.join(dataDirectory, "recipes.json"), "utf8"));

assert.equal(catalog.version, 3);
assert.equal(catalog.license, "Apache-2.0");
assert.ok(Array.isArray(catalog.sources) && catalog.sources.length > 0);
assert.ok(Array.isArray(catalog.recipes) && catalog.recipes.length > 0);

const sourceIds = new Set();
const sourceKinds = new Map();
const allowedSourceKinds = new Set(["manufacturer-publication", "community-contribution"]);
for (const source of catalog.sources) {
  assert.equal(typeof source.id, "string");
  assert.ok(allowedSourceKinds.has(source.kind), `Unknown source kind: ${source.kind}`);
  assert.equal(typeof source.title, "string");
  assert.equal(typeof source.publisher, "string");
  assert.match(source.url, /^https:\/\//);
  assert.match(source.retrievedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(typeof source.licenseBasis, "string");
  assert.equal(sourceIds.has(source.id), false, `Duplicate source ID: ${source.id}`);
  sourceIds.add(source.id);
  sourceKinds.set(source.id, source.kind);
}

const agitationMethods = new Set(["standard", "ilford", "kodak", "rodinal", "stand"]);
const confidenceTypes = new Set(["manufacturer-published", "community-reported"]);
const recipeKeys = new Set();
for (const recipe of catalog.recipes) {
  assert.equal(typeof recipe.film, "string");
  assert.equal(typeof recipe.developer, "string");
  assert.equal(typeof recipe.dilution, "string");
  assert.ok(Number.isInteger(recipe.seconds) && recipe.seconds > 0);
  assert.ok(Number.isFinite(recipe.temperatureC) && recipe.temperatureC > 0);
  assert.ok(sourceIds.has(recipe.sourceId), `Unknown source ID: ${recipe.sourceId}`);
  assert.ok(confidenceTypes.has(recipe.confidence), `Unknown confidence type: ${recipe.confidence}`);
  assert.ok(agitationMethods.has(recipe.agitation), `Unknown agitation method: ${recipe.agitation}`);
  assert.notEqual(recipe.source, "mikey");

  const sourceKind = sourceKinds.get(recipe.sourceId);
  if (sourceKind === "manufacturer-publication") {
    assert.equal(recipe.confidence, "manufacturer-published");
  } else {
    assert.equal(recipe.confidence, "community-reported");
  }

  const key = [recipe.film, recipe.developer, recipe.dilution, recipe.seconds, recipe.temperatureC, recipe.ei || "", recipe.format || "any"].join("|");
  assert.equal(recipeKeys.has(key), false, `Duplicate recipe: ${key}`);
  recipeKeys.add(key);
}

for (const removedFile of ["rodinal-recipes.json", "xtol-recipes.json", "d76-recipes.json", "hc110-recipes.json"]) {
  assert.equal(fs.existsSync(path.join(dataDirectory, removedFile)), false, `${removedFile} must stay excluded pending a written license`);
}

// Curated B&W film and developer picker tests
assert.ok(BW_FILMS.length >= 450, "Expected curated B&W film picker list");
assert.ok(BW_DEVELOPERS.length >= 300, "Expected curated B&W developer picker list");

const byFilm = new Map();
const filmEntries = [];
for (const recipe of catalog.recipes) {
  const normalizedFilm = normalizeFilmName(recipe.film);
  if (!byFilm.has(normalizedFilm)) {
    byFilm.set(normalizedFilm, []);
    filmEntries.push({ normalized: normalizedFilm, key: `film:${normalizedFilm}`, fullName: recipe.film });
  }
  byFilm.get(normalizedFilm).push({
    ...recipe,
    normalizedDeveloper: normalizeDeveloperName(recipe.developer)
  });
}

const mergedFilms = buildFilmList(filmEntries);
const filmKeys = new Set(mergedFilms.map((f) => f.key));
assert.equal(filmKeys.size, mergedFilms.length, "Merged film list must not contain duplicate normalized keys");
assert.equal(mergedFilms.filter((f) => normalizeFilmName(f.fullName) === "kodak tmax 100").length, 1, "Kodak T-MAX 100 / TMax 100 should deduplicate");
assert.equal(mergedFilms.filter((f) => normalizeFilmName(f.fullName) === "ilford fp4 plus").length, 1, "Ilford FP4 Plus / FP4+ should deduplicate");

const mergedDevelopers = buildDeveloperList(byFilm);
const devKeys = new Set(mergedDevelopers.map((d) => d.key));
assert.equal(devKeys.size, mergedDevelopers.length, "Merged developer list must not contain duplicate normalized keys");
assert.equal(normalizeDeveloperName("Kodak D-76"), normalizeDeveloperName("D-76"));
assert.equal(normalizeDeveloperName("Kodak XTOL"), normalizeDeveloperName("Xtol"));
assert.equal(normalizeDeveloperName("Kodak HC-110"), normalizeDeveloperName("HC-110"));
assert.equal(normalizeDeveloperName("Kodak T-MAX Developer"), normalizeDeveloperName("TMax Dev"));
assert.equal(normalizeDeveloperName("Ilford ID-11"), normalizeDeveloperName("ID-11"));
assert.equal(normalizeDeveloperName("Ilford ILFOTEC LC29"), normalizeDeveloperName("Ilfotec LC29"));

const fp4 = mergedFilms.find((f) => f.normalized === "ilford fp4 plus");
assert.ok(getRecipesForFilm(fp4, byFilm).length > 0, "Verified film should return recipes");
assert.equal(fp4.defaultIso, 125, "Ilford FP4 Plus default ISO should be 125");
const tmax100 = mergedFilms.find((f) => f.normalized === "kodak tmax 100");
assert.equal(tmax100.defaultIso, 100, "Kodak T-MAX 100 default ISO should be 100");
const hp5 = mergedFilms.find((f) => f.normalized === "ilford hp5 plus");
assert.equal(getRecipesForFilm(hp5, byFilm).length, 0, "Unverified film should return empty recipe list to trigger Custom Recipe");
assert.equal(hp5.defaultIso, 400, "Ilford HP5+ default ISO should be 400");
const delta3200 = mergedFilms.find((f) => f.normalized === "ilford delta 3200");
assert.equal(delta3200.defaultIso, 3200, "Ilford Delta 3200 default ISO should be 3200");
assert.ok(mergedFilms.every((f) => Number.isInteger(f.defaultIso) && f.defaultIso > 0), "Every film should have a positive integer default ISO");
assert.equal(mergedFilms.filter((f) => Number.isFinite(f.popularRank)).length, 40, "Exactly 40 popular films should match the merged film list");
assert.equal(mergedDevelopers.filter((d) => Number.isFinite(d.popularRank)).length, 40, "Exactly 40 popular developers should match the merged developer list");

console.log(`Recipe catalog tests passed (${catalog.recipes.length} recipes, ${catalog.sources.length} sources, ${mergedFilms.length} films, ${mergedDevelopers.length} developers).`);
