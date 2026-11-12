// Scene geometry and procedural Canvas 2D drawing.
//
// This module has no DOM access. Gameplay code (collision, vision, shadows)
// and drawing share ONE polygon per wall: buildWall() flattens rounded corners
// into plain vertices once, and every consumer reads those same vertices.

const FONT = '"Noto Sans TC","Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif';

// ---------------------------------------------------------------- geometry

const toPoint = (p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y });

/**
 * Round every corner of a polygon and return a flattened polygon.
 * Works for convex and concave (reflex) corners, so an L-shaped wall gets a
 * smooth inner fillet as well as smooth outer corners.
 *
 * @param points   [[x,y]...] or [{x,y}...]
 * @param radius   one number for all corners, or one number per vertex
 * @param segments line segments used to approximate each rounded corner
 */
export function roundPolygon(points, radius = 0, segments = 4) {
  const pts = points.map(toPoint);
  const n = pts.length;
  const out = [];
  const push = (x, y) => {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last.x - x, last.y - y) > 1e-6) out.push({ x, y });
  };
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i + n - 1) % n];
    const b = pts[(i + 1) % n];
    const r = Array.isArray(radius) ? radius[i] || 0 : radius;
    const v1x = a.x - p.x, v1y = a.y - p.y;
    const v2x = b.x - p.x, v2y = b.y - p.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    const cross = v1x * v2y - v1y * v2x;
    const straight = Math.abs(cross) < 1e-9 * len1 * len2 && v1x * v2x + v1y * v2y < 0;
    const d = Math.min(r, len1 / 2, len2 / 2);
    if (d <= 1e-6 || straight || len1 === 0 || len2 === 0) { push(p.x, p.y); continue; }
    const inX = p.x + (v1x / len1) * d, inY = p.y + (v1y / len1) * d;
    const outX = p.x + (v2x / len2) * d, outY = p.y + (v2y / len2) * d;
    for (let k = 0; k <= segments; k++) {
      const t = k / segments, u = 1 - t;
      push(u * u * inX + 2 * u * t * p.x + t * t * outX, u * u * inY + 2 * u * t * p.y + t * t * outY);
    }
  }
  // The first and last vertex may coincide after smoothing.
  while (out.length > 1 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= 1e-6) out.pop();
  return out;
}

export function polygonBounds(verts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export const rectPoints = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/**
 * Build one wall from absolute polygon points.
 * Returned fields keep the shape that mvp.js already expects:
 *   x,y,w,h  bounding box (cheap broad-phase for collision)
 *   points   vertices relative to x,y
 *   verts    absolute vertices, computed once and shared by collision,
 *            vision casting, shadows and drawing
 */
export function buildWall({ id, points, radius = 0, segments = 2, gate = false, style = "stone" }) {
  const verts = roundPolygon(points, radius, segments);
  const box = polygonBounds(verts);
  return {
    id, gate, style,
    x: box.x, y: box.y, w: box.w, h: box.h,
    points: verts.map((v) => [v.x - box.x, v.y - box.y]),
    verts
  };
}

// ----------------------------------------------------------- canvas helpers

function tracePolygon(ctx, verts) {
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
  ctx.closePath();
}

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Same geometry as CSS linear-gradient(<angle>deg, ...) over a box.
function cssLinearGradient(ctx, x, y, w, h, angleDeg, stops) {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(a), dy = -Math.cos(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = x + w / 2, cy = y + h / 2;
  const g = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  return g;
}

function setLetterSpacing(ctx, px) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${px}px`;
}

// -------------------------------------------------------------- walls / gate

export const WALL_STYLES = {
  stone: { angle: 145, stops: [[0, "#62766e"], [0.68, "#344d4c"], [1, "#263e40"]], border: "#8a9a8d" },
  stoneL: { angle: 145, stops: [[0, "#71877a"], [0.58, "#3d5a55"], [1, "#263f40"]], border: "#8a9a8d" }
};

export function drawWall(ctx, wall) {
  const style = WALL_STYLES[wall.style] || WALL_STYLES.stone;
  ctx.save();
  tracePolygon(ctx, wall.verts);
  ctx.fillStyle = cssLinearGradient(ctx, wall.x, wall.y, wall.w, wall.h, style.angle, style.stops);
  ctx.fill();
  ctx.clip();
  ctx.lineJoin = "round";
  // Inner rim light and border both follow every edge of the polygon,
  // including a concave inner corner, so no edge looks "cut out".
  tracePolygon(ctx, wall.verts);
  ctx.strokeStyle = "rgba(233,245,218,0.10)";
  ctx.lineWidth = 10;
  ctx.stroke();
  tracePolygon(ctx, wall.verts);
  ctx.strokeStyle = style.border;
  ctx.lineWidth = 4; // clipped to the polygon: 2px visible inside the edge
  ctx.stroke();
  ctx.restore();
}

export function drawGate(ctx, gate) {
  ctx.save();
  tracePolygon(ctx, gate.verts);
  ctx.clip();
  ctx.fillStyle = "#8c8165";
  ctx.fillRect(gate.x, gate.y, gate.w, gate.h);
  for (let x = gate.x + 3; x < gate.x + gate.w; x += 20) {
    ctx.fillStyle = "#8c8165"; ctx.fillRect(x, gate.y, 10.5, gate.h);
    ctx.fillStyle = "#c0b48b"; ctx.fillRect(x + 10.5, gate.y, 4, gate.h);
    ctx.fillStyle = "#655f4e"; ctx.fillRect(x + 14.5, gate.y, 5.5, gate.h);
  }
  ctx.lineJoin = "round";
  // Inner glow from stacked translucent strokes (clipped to the gate). No
  // shadowBlur: a blurred stroke inside a clip wiped earlier drawing in Chromium.
  for (const [width, alpha] of [[24, 0.05], [16, 0.07], [10, 0.1], [6, 0.14]]) {
    tracePolygon(ctx, gate.verts);
    ctx.strokeStyle = `rgba(236,212,146,${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  tracePolygon(ctx, gate.verts);
  ctx.strokeStyle = "#d2c7a0";
  ctx.lineWidth = 6; // 3px visible inside the clip
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- water zone

function waterShape(area) {
  const r = area.radii || 30;
  return roundPolygon(rectPoints(area.x, area.y, area.w, area.h), r, 8);
}

export function drawWaterArea(ctx, area) {
  const verts = waterShape(area);
  ctx.save();
  // Soft outer halo: stacked translucent strokes under the water fill.
  ctx.lineJoin = "round";
  for (const [width, alpha] of [[40, 0.025], [28, 0.04], [18, 0.06], [10, 0.08]]) {
    tracePolygon(ctx, verts);
    ctx.strokeStyle = `rgba(54,178,204,${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  tracePolygon(ctx, verts);
  ctx.fillStyle = cssLinearGradient(ctx, area.x, area.y, area.w, area.h, 145, [
    [0, "rgba(61,164,183,0.82)"], [0.58, "rgba(22,91,119,0.9)"], [1, "rgba(12,57,82,0.94)"]
  ]);
  ctx.fill();
  ctx.clip();

  // Inner glow and static ripple lines (clipped to the shoreline).
  ctx.lineJoin = "round";
  for (const [width, alpha] of [[56, 0.03], [40, 0.04], [26, 0.05], [14, 0.07], [6, 0.09]]) {
    tracePolygon(ctx, verts);
    ctx.strokeStyle = `rgba(180,245,245,${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  for (const rip of [{ left: -0.12, top: 0.22 }, { left: -0.04, top: 0.52 }]) {
    const bw = area.w * 1.25, bh = area.h * 0.45;
    ctx.save();
    ctx.translate(area.x + rip.left * area.w + bw / 2, area.y + rip.top * area.h + bh / 2);
    ctx.rotate((-8 * Math.PI) / 180);
    ctx.beginPath();
    ctx.ellipse(0, 0, bw / 2, bh / 2, 0, Math.PI, Math.PI * 2);
    ctx.strokeStyle = "rgba(205,249,245,0.32)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  tracePolygon(ctx, verts);
  ctx.strokeStyle = "rgba(133,220,231,0.78)";
  ctx.lineWidth = 6; // 3px visible inside the clip
  ctx.stroke();
  ctx.restore();

  if (area.label) drawPill(ctx, area.label, area.x + area.w / 2, area.y + area.h / 2);
}

function drawPill(ctx, text, cx, cy) {
  ctx.save();
  ctx.font = `13px ${FONT}`;
  setLetterSpacing(ctx, 1.56);
  const w = ctx.measureText(text).width + 24;
  const h = 31;
  roundRectPath(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = "rgba(6,39,55,0.58)";
  ctx.fill();
  ctx.strokeStyle = "rgba(208,247,245,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(8,45,58,0.85)"; // drop shadow drawn as offset text
  ctx.fillText(text, cx + 0.78, cy + 2);
  ctx.fillStyle = "#e2fbfa";
  ctx.fillText(text, cx + 0.78, cy + 1);
  ctx.restore();
}

// ------------------------------------------------------------- hazard zone

export function drawDamageZone(ctx, zone) {
  ctx.save();
  roundRectPath(ctx, zone.x, zone.y, zone.w, zone.h, 10);
  ctx.clip();
  // repeating-linear-gradient(135deg, A 0 10px, B 10px 20px)
  ctx.fillStyle = "rgba(70,20,27,0.76)";
  ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
  ctx.translate(zone.x + zone.w / 2, zone.y + zone.h / 2);
  ctx.rotate(Math.PI / 4);
  const reach = Math.hypot(zone.w, zone.h);
  ctx.fillStyle = "rgba(130,30,35,0.68)";
  for (let s = -Math.ceil(reach / 20) * 20; s < reach; s += 20) ctx.fillRect(s, -reach, 10, reach * 2);
  ctx.rotate(-Math.PI / 4);
  ctx.translate(-(zone.x + zone.w / 2), -(zone.y + zone.h / 2));

  roundRectPath(ctx, zone.x, zone.y, zone.w, zone.h, 10);
  ctx.setLineDash([7, 4]);
  ctx.strokeStyle = "rgba(255,112,102,0.9)";
  ctx.lineWidth = 4; // clipped: 2px visible inside
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  if (zone.label || zone.note) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cx = zone.x + zone.w / 2, cy = zone.y + zone.h / 2;
    // Each line: dark offset copy first (drop shadow), then the light text.
    const line = (text, x, y) => {
      ctx.fillStyle = "rgba(38,9,11,0.85)";
      ctx.fillText(text, x, y + 1);
      ctx.fillStyle = "#fff0e8";
      ctx.fillText(text, x, y);
    };
    if (zone.label) {
      ctx.font = `800 13px ${FONT}`;
      setLetterSpacing(ctx, 1.56);
      line(zone.label, cx + 0.78, cy - 9);
    }
    if (zone.note) {
      ctx.font = `11px ${FONT}`;
      setLetterSpacing(ctx, 0);
      line(zone.note, cx, cy + 9);
    }
    ctx.restore();
  }
}

// ----------------------------------------------------------- scene composition

/**
 * Draw the static world layer. Order matches the old DOM stacking:
 * water, hazard, walls, then the gate on top while it is closed.
 * The caller sets the world-to-bitmap transform and decides when to redraw.
 */
export function drawSceneStatic(ctx, scene) {
  ctx.save();
  ctx.clearRect(0, 0, scene.width, scene.height);
  for (const water of scene.waters) drawWaterArea(ctx, water);
  for (const zone of scene.hazards) drawDamageZone(ctx, zone);
  for (const wall of scene.walls) if (!wall.gate) drawWall(ctx, wall);
  for (const wall of scene.walls) if (wall.gate && !scene.gateOpen) drawGate(ctx, wall);
  ctx.restore();
}
