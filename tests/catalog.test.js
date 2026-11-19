import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

console.log(`Recipe catalog tests passed (${catalog.recipes.length} recipes, ${catalog.sources.length} sources).`);
