import { buildWall, createPathGeometry, pathGeometryToCollisionPolygons } from "./scene-render.js";
const ID=/^[a-z0-9][a-z0-9._-]*$/;
const COMMANDS=new Set(["moveTo","lineTo","quadraticCurveTo","bezierCurveTo","arc","ellipse","closePath"]);
const SURFACES=new Set(["sand","water","grass","rock","soil","stone"]);
const TRAVERSAL=new Set(["walkable","water","blocked","restricted"]);
const COLLISION=new Set(["none","solid","water","hazard"]);
const STYLES=new Set(["stone","stoneL"]);
const assert=(ok,message)=>{if(!ok)throw new TypeError("Invalid scene data: "+message);};
const validId=value=>typeof value==="string"&&ID.test(value);
function validatePath(path,label){
 assert(path&&path.type==="PathGeometry"&&path.version===1&&Array.isArray(path.commands)&&path.commands.length>1,label+" must be PathGeometry v1");
 assert(path.commands[0].type==="moveTo",label+" must start with moveTo");
 for(const command of path.commands){
  assert(command&&COMMANDS.has(command.type),label+" has unsupported path command");
  for(const [key,value] of Object.entries(command))if(key!=="type"&&key!=="counterclockwise")assert(Number.isFinite(value),label+" has non-finite "+key);
 }
 assert(path.commands.some(command=>command.type==="closePath"),label+" must be closed");
}
function validateManifest(manifest){
 assert(manifest&&manifest.schemaVersion===1&&Array.isArray(manifest.assets)&&Array.isArray(manifest.proceduralMaterials),"asset manifest v1 required");
 const assets=new Set(),materials=new Set();
 for(const asset of manifest.assets){
  assert(validId(asset.id)&&!assets.has(asset.id),"asset IDs must be valid and unique");assets.add(asset.id);
  assert(["image","audio"].includes(asset.type),"unsupported asset type");
  assert(typeof asset.src==="string"&&asset.src.startsWith("./assets/")&&!asset.src.includes(".."),"asset path must remain inside ./assets/");
  if(asset.type==="image")assert(Number.isFinite(asset.width)&&asset.width>0&&Number.isFinite(asset.height)&&asset.height>0,"image dimensions required");
 }
 for(const material of manifest.proceduralMaterials){
  assert(validId(material.id)&&!materials.has(material.id),"material IDs must be valid and unique");materials.add(material.id);
  assert(typeof material.renderer==="string"&&material.renderer.length>0,"material renderer required");
 }
 return {assets,materials};
}
function validateScene(scene,indexes){
 assert(scene&&scene.schemaVersion===1&&validId(scene.id),"scene header invalid");
 assert(scene.world&&Number.isFinite(scene.world.width)&&scene.world.width>0&&Number.isFinite(scene.world.height)&&scene.world.height>0,"world dimensions invalid");
 assert(Array.isArray(scene.chunks)&&scene.chunks.length>0,"scene chunks required");
 const chunkIds=new Set(),entityIds=new Set();
 for(const chunk of scene.chunks){
  assert(validId(chunk.id)&&!chunkIds.has(chunk.id),"chunk IDs must be unique");chunkIds.add(chunk.id);
  const b=chunk.bounds;
  assert(b&&[b.x,b.y,b.width,b.height].every(Number.isFinite)&&b.width>0&&b.height>0,"chunk bounds invalid");
  assert(b.x>=0&&b.y>=0&&b.x+b.width<=scene.world.width&&b.y+b.height<=scene.world.height,"chunk outside world bounds");
  assert(Array.isArray(chunk.terrainRegions)&&Array.isArray(chunk.obstacles),"chunk entity arrays required");
  for(const region of chunk.terrainRegions){
   assert(validId(region.id)&&!entityIds.has(region.id),"entity IDs must be globally unique");entityIds.add(region.id);
   assert(typeof region.regionType==="string"&&SURFACES.has(region.surface),"terrain surface invalid");
   assert(TRAVERSAL.has(region.traversal)&&COLLISION.has(region.collision),"terrain semantics invalid");
   validatePath(region.path,"terrain "+region.id);
   if(region.assetId)assert(indexes.assets.has(region.assetId),"unknown asset "+region.assetId);
   if(region.materialId)assert(indexes.materials.has(region.materialId),"unknown material "+region.materialId);
   for(const item of [...(region.decorations||[]),...(region.ripples||[])])assert(item&&["x","y","rx","ry","rotation"].every(key=>Number.isFinite(item[key])),"decoration geometry invalid");
  }
  for(const wall of chunk.obstacles){
   assert(validId(wall.id)&&!entityIds.has(wall.id),"entity IDs must be globally unique");entityIds.add(wall.id);
   assert(STYLES.has(wall.style)&&typeof wall.gate==="boolean","wall style/gate invalid");
   validatePath(wall.path,"wall "+wall.id);
   if(wall.assetId)assert(indexes.assets.has(wall.assetId),"unknown wall asset "+wall.assetId);
  }
 }
}
async function readJson(url){const response=await fetch(url);if(!response.ok)throw new Error("Unable to load "+url+" ("+response.status+")");return response.json();}
export async function loadScenePackage({sceneUrl="./data/scenes/test-coast-ruins.json",manifestUrl="./data/asset-manifest.json"}={}){
 const [scene,manifest]=await Promise.all([readJson(sceneUrl),readJson(manifestUrl)]);
 const indexes=validateManifest(manifest);validateScene(scene,indexes);
 const terrainRegions=[],obstacles=[];
 for(const chunk of scene.chunks){
  for(const region of chunk.terrainRegions)terrainRegions.push({...region,path:createPathGeometry(region.path.commands)});
  for(const wall of chunk.obstacles)obstacles.push(buildWall({id:wall.id,style:wall.style,gate:wall.gate,path:createPathGeometry(wall.path.commands)}));
 }
 const waterAreas=terrainRegions.filter(region=>region.traversal==="water").map(region=>({...region,collisionPolygons:pathGeometryToCollisionPolygons(region.path)}));
 return {sceneId:scene.id,name:scene.name,world:{...scene.world},chunks:scene.chunks.map(chunk=>({id:chunk.id,bounds:{...chunk.bounds}})),terrainRegions,waterAreas,obstacles,assetManifest:manifest};
}
