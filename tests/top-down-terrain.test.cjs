#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");

const rendererSource = fs.readFileSync("js/scene-render.js", "utf8").replace(/\\bexport\\s+/g, "");
const renderer = new Function(rendererSource + "\\nreturn { createPathGeometry, flattenPathGeometry, pathGeometryToCollisionPolygons };")();
const scene = JSON.parse(fs.readFileSync("data/scenes/test-coast-ruins.json", "utf8"));
const regions = scene.chunks.flatMap((chunk) => chunk.terrainRegions);
const obstacles = scene.chunks.flatMap((chunk) => chunk.obstacles);

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
        point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}
const beach = regions.find((region) => region.id === "test-natural-sand-beach");
const water = regions.find((region) => region.id === "test-natural-coast-water");
assert.ok(beach && water, "T3 beach and water regions exist");
assert.equal(beach.surface, "sand");
assert.equal(beach.traversal, "walkable");
assert.equal(water.surface, "water");
assert.equal(water.traversal, "water");
assert.equal(beach.decorations.length, 6);
assert.equal(water.ripples.length, 3);

for (const region of [beach, water]) {
  const path = renderer.createPathGeometry(region.path.commands);
  const flattened = renderer.flattenPathGeometry(path);
  assert.equal(flattened.length, 1);
  assert.equal(flattened[0].closed, true);
  assert.ok(flattened[0].points.length >= 20);
}
const waterPath = renderer.createPathGeometry(water.path.commands);
const waterPolygon = renderer.pathGeometryToCollisionPolygons(waterPath)[0].points;
assert.ok(inside({ x: 1200, y: 900 }, waterPolygon), "known water point is inside");
assert.ok(!inside({ x: 1100, y: 700 }, waterPolygon), "known land point is outside water");
assert.ok(!inside({ x: 900, y: 900 }, waterPolygon), "outside point is outside water");

const cave = obstacles.find((wall) => wall.id === "test-natural-cave-rim");
assert.ok(cave, "C-shaped cave rim exists");
const cavePath = renderer.createPathGeometry(cave.path.commands);
const cavePolygon = renderer.pathGeometryToCollisionPolygons(cavePath)[0].points;
assert.ok(inside({ x: 1385, y: 385 }, cavePolygon), "cave rim remains solid");
assert.ok(!inside({ x: 1260, y: 450 }, cavePolygon), "cave interior remains open");
assert.ok(!inside({ x: 1125, y: 480 }, cavePolygon), "west-facing cave mouth remains open");
assert.ok(!inside({ x: 1000, y: 300 }, cavePolygon), "outside cave remains outside rim");

console.log("T3 terrain geometry regression: PASS");
console.log(JSON.stringify({
  beach: { vertices: renderer.flattenPathGeometry(renderer.createPathGeometry(beach.path.commands))[0].points.length,
    area: Math.round(area(renderer.pathGeometryToCollisionPolygons(renderer.createPathGeometry(beach.path.commands))[0].points)) },
  water: { vertices: renderer.flattenPathGeometry(waterPath)[0].points.length, area: Math.round(area(waterPolygon)) },
  cave: { vertices: cavePolygon.length, area: Math.round(area(cavePolygon)), interiorOpen: true, westMouthOpen: true }
}, null, 2));
