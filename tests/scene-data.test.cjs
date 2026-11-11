#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const scene=JSON.parse(fs.readFileSync("data/scenes/test-coast-ruins.json","utf8"));
const manifest=JSON.parse(fs.readFileSync("data/asset-manifest.json","utf8"));
const schema=JSON.parse(fs.readFileSync("data/schemas/scene-v1.schema.json","utf8"));
assert.equal(scene.schemaVersion,1);assert.equal(schema.properties.schemaVersion.const,1);
assert.equal(scene.world.width,1600);assert.equal(scene.world.height,1000);assert.ok(scene.chunks.length);
const ids=new Set();
for(const chunk of scene.chunks){const b=chunk.bounds;assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=scene.world.width&&b.y+b.height<=scene.world.height);
 for(const item of [...chunk.terrainRegions,...chunk.obstacles]){assert.match(item.id,/^[a-z0-9][a-z0-9._-]*$/);assert.ok(!ids.has(item.id),"duplicate ID "+item.id);ids.add(item.id);assert.equal(item.path.type,"PathGeometry");assert.equal(item.path.version,1);assert.equal(item.path.commands[0].type,"moveTo");assert.ok(item.path.commands.some(c=>c.type==="closePath"));}}
const regions=scene.chunks.flatMap(c=>c.terrainRegions),walls=scene.chunks.flatMap(c=>c.obstacles);
assert.equal(regions.length,2);assert.equal(walls.length,7);assert.ok(regions.some(r=>r.surface==="sand"&&r.traversal==="walkable"));assert.ok(regions.some(r=>r.surface==="water"&&r.traversal==="water"));assert.ok(walls.some(w=>w.id==="test-natural-cave-rim"));assert.ok(walls.some(w=>w.id==="test-gate"&&w.gate));
assert.equal(manifest.schemaVersion,1);assert.ok(Array.isArray(manifest.assets));assert.ok(manifest.proceduralMaterials.some(m=>m.id==="sand"));
console.log("T4 scene schema and asset manifest: PASS");
console.log(JSON.stringify({chunks:scene.chunks.length,terrainRegions:regions.length,obstacles:walls.length,assetFiles:manifest.assets.length,proceduralMaterials:manifest.proceduralMaterials.length},null,2));
