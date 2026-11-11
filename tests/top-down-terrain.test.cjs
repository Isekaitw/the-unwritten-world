#!/usr/bin/env node
"use strict";

// T3 regression test against the exact PathGeometry and terrain definitions
// currently used by the game. No browser globals or third-party packages.
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const sceneSource = fs.readFileSync("js/scene-render.js", "utf8")
  .replace(/\\bexport\\s+/g, "");
const mvpSource = fs.readFileSync("js/mvp.js", "utf8");
const context = vm.createContext({ console, Math, Number, Object, Array, Map, Set, TypeError, RangeError });

vm.runInContext(sceneSource + `
globalThis.__api = {
  createPathGeometry, flattenPathGeometry, pathGeometryToCollisionPolygons, buildWall
};
`, context);

function sourceBlock(start, end) {
  const from = mvpSource.indexOf(start);
  const to = mvpSource.indexOf(end, from);
  assert.ok(from >= 0 && to > from, "source block exists: " + start);
  return mvpSource.slice(from, to);
}

vm.runInContext(sourceBlock("const beachPath = createPathGeometry([", "const terrainRegions =") + `
globalThis.__paths = { beachPath, coastWaterPath };
`, context);
vm.runInContext(sourceBlock("const terrainRegions = [", "const waterAreas =") + `
globalThis.__regions = terrainRegions;
`, context);

const caveStart = mvpSource.indexOf('buildWall({ id: "test-natural-cave-rim"');
const caveEnd = mvpSource.indexOf("  // Test-only concave L-shaped wall", caveStart);
assert.ok(caveStart >= 0 && caveEnd > caveStart, "C-shaped cave source exists");
const caveExpression = mvpSource.slice(caveStart, caveEnd).trim().replace(/,$/, "");
vm.runInContext(`globalThis.__cave = ${caveExpression};`, context);

const { __api: api, __paths: paths, __regions: regions, __cave: cave } = context;
function area(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum / 2);
}
function inside(point, points) {
  let result = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > point.y) !== (b.y > point.y) &&
        point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) {
      result = !result;
    }
  }
  return result;
}
function check(condition, message) { assert.ok(condition, message); }

for (const path of [paths.beachPath, paths.coastWaterPath]) {
  const flattened = api.flattenPathGeometry(path);
  check(flattened.length === 1 && flattened[0].closed, "terrain path must be one closed contour");
  check(flattened[0].points.length >= 20, "terrain curve must retain smooth subdivision");
}
const beach = regions.find((region) => region.id === "test-natural-sand-beach");
const water = regions.find((region) => region.id === "test-natural-coast-water");
check(beach && water, "T3 sand and water regions exist");
check(beach.surface === "sand" && beach.traversal === "walkable", "sand semantics remain walkable");
check(water.surface === "water" && water.traversal === "water", "water semantics remain water");
check(beach.decorations.length === 6, "six fixed beach pebbles remain presentation-only");
check(water.ripples.length === 3, "three static water ripples remain presentation-only");

const waterPolygon = api.pathGeometryToCollisionPolygons(water.path)[0].points;
check(inside({ x: 1200, y: 900 }, waterPolygon), "known interior water point is inside");
check(!inside({ x: 1100, y: 700 }, waterPolygon), "known land point is outside water");
check(!inside({ x: 900, y: 900 }, waterPolygon), "known exterior point is outside water");

check(cave && cave.path && cave.collisionPolygons.length === 1, "C-shaped cave has source path and collision");
const cavePolygon = cave.collisionPolygons[0].points;
check(inside({ x: 1385, y: 385 }, cavePolygon), "known cave rim point is blocked geometry");
check(!inside({ x: 1260, y: 450 }, cavePolygon), "cave interior remains open");
check(!inside({ x: 1125, y: 480 }, cavePolygon), "west-facing cave mouth remains open");
check(!inside({ x: 1000, y: 300 }, cavePolygon), "outside cave remains outside rim");

console.log("T3 terrain geometry regression: PASS");
console.log(JSON.stringify({
  beach: { vertices: api.flattenPathGeometry(paths.beachPath)[0].points.length, area: Math.round(area(api.pathGeometryToCollisionPolygons(paths.beachPath)[0].points)) },
  water: { vertices: api.flattenPathGeometry(paths.coastWaterPath)[0].points.length, area: Math.round(area(waterPolygon)) },
  cave: { vertices: cavePolygon.length, area: Math.round(area(cavePolygon)), interiorOpen: true, westMouthOpen: true }
}, null, 2));
