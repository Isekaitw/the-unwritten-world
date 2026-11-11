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


/**
 * Create immutable, renderer-independent path data.
 * Commands mirror the Canvas 2D path vocabulary and contain plain data only.
 * Supported types: moveTo, lineTo, quadraticCurveTo, bezierCurveTo,
 * arc, ellipse and closePath.
 */
export function createPathGeometry(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new TypeError("Path geometry requires a non-empty command array.");
  }
  const finite = (command, fields) => {
    for (const field of fields) {
      if (!Number.isFinite(command[field])) {
        throw new TypeError(`Path command ${command.type} requires finite ${field}.`);
      }
    }
  };
  const schemas = {
    moveTo: ["x", "y"],
    lineTo: ["x", "y"],
    quadraticCurveTo: ["cpx", "cpy", "x", "y"],
    bezierCurveTo: ["cp1x", "cp1y", "cp2x", "cp2y", "x", "y"],
    arc: ["x", "y", "radius", "startAngle", "endAngle"],
    ellipse: ["x", "y", "radiusX", "radiusY", "rotation", "startAngle", "endAngle"]
  };
  if (commands[0]?.type !== "moveTo") {
    throw new TypeError("The first path command must be moveTo.");
  }
  const normalized = commands.map((source) => {
    if (!source || typeof source !== "object" || typeof source.type !== "string") {
      throw new TypeError("Every path command must have a type.");
    }
    if (source.type === "closePath") return Object.freeze({ type: "closePath" });
    const fields = schemas[source.type];
    if (!fields) throw new TypeError(`Unsupported path command: ${source.type}`);
    finite(source, fields);
    if (source.type === "arc" && source.radius < 0) {
      throw new RangeError("Arc radius cannot be negative.");
    }
    if (source.type === "ellipse" && (source.radiusX < 0 || source.radiusY < 0)) {
      throw new RangeError("Ellipse radii cannot be negative.");
    }
    const command = { type: source.type };
    for (const field of fields) command[field] = source[field];
    if (source.type === "arc" || source.type === "ellipse") {
      command.counterclockwise = Boolean(source.counterclockwise);
    }
    return Object.freeze(command);
  });
  return Object.freeze({
    type: "PathGeometry",
    version: 1,
    closed: normalized.some((command) => command.type === "closePath"),
    commands: Object.freeze(normalized)
  });
}

function appendPathGeometry(target, geometry) {
  if (!geometry || geometry.type !== "PathGeometry" || geometry.version !== 1 ||
      !Array.isArray(geometry.commands)) {
    throw new TypeError("Expected PathGeometry version 1.");
  }
  for (const command of geometry.commands) {
    switch (command.type) {
      case "moveTo": target.moveTo(command.x, command.y); break;
      case "lineTo": target.lineTo(command.x, command.y); break;
      case "quadraticCurveTo":
        target.quadraticCurveTo(command.cpx, command.cpy, command.x, command.y);
        break;
      case "bezierCurveTo":
        target.bezierCurveTo(command.cp1x, command.cp1y, command.cp2x, command.cp2y, command.x, command.y);
        break;
      case "arc":
        target.arc(command.x, command.y, command.radius, command.startAngle, command.endAngle, command.counterclockwise);
        break;
      case "ellipse":
        target.ellipse(command.x, command.y, command.radiusX, command.radiusY, command.rotation,
          command.startAngle, command.endAngle, command.counterclockwise);
        break;
      case "closePath": target.closePath(); break;
      default: throw new TypeError(`Unsupported path command: ${command.type}`);
    }
  }
}

/** Begin a Canvas 2D path and append shared geometry data. */
export function tracePathGeometry(ctx, geometry) {
  if (!ctx || typeof ctx.beginPath !== "function") {
    throw new TypeError("tracePathGeometry requires a Canvas 2D context.");
  }
  ctx.beginPath();
  appendPathGeometry(ctx, geometry);
}

/**
 * Flatten a PathGeometry into world-coordinate subpaths.
 * tolerance is the maximum control-point deviation used for Bezier subdivision
 * and the maximum radial sagitta used for arc sampling.
 */
export function flattenPathGeometry(geometry, { tolerance = 0.75, maxDepth = 12 } = {}) {
  if (!geometry || geometry.type !== "PathGeometry" || geometry.version !== 1 ||
      !Array.isArray(geometry.commands)) {
    throw new TypeError("Expected PathGeometry version 1.");
  }
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    throw new RangeError("Flattening tolerance must be a positive finite number.");
  }
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 20) {
    throw new RangeError("maxDepth must be an integer from 1 to 20.");
  }

  const result = [];
  let points = null;
  let current = null;
  let start = null;
  let closed = false;
  const epsilon = 1e-7;
  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const pointSegmentDistance = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < epsilon * epsilon) return distance(p, a);
    const projection = Math.max(0, Math.min(1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
    return Math.hypot(p.x - (a.x + projection * dx), p.y - (a.y + projection * dy));
  };
  const push = (point) => {
    const next = { x: point.x, y: point.y };
    if (!points) {
      points = [next];
      start = next;
    } else if (distance(points[points.length - 1], next) > epsilon) {
      points.push(next);
    }
    current = next;
  };
  const finish = () => {
    if (points?.length) result.push({ points, closed });
    points = null;
    current = null;
    start = null;
    closed = false;
  };
  const flattenQuadratic = (p0, p1, p2, depth = 0) => {
    if (depth >= maxDepth || pointSegmentDistance(p1, p0, p2) <= tolerance) {
      push(p2);
      return;
    }
    const p01 = midpoint(p0, p1), p12 = midpoint(p1, p2), p012 = midpoint(p01, p12);
    flattenQuadratic(p0, p01, p012, depth + 1);
    flattenQuadratic(p012, p12, p2, depth + 1);
  };
  const flattenCubic = (p0, p1, p2, p3, depth = 0) => {
    const flatness = Math.max(pointSegmentDistance(p1, p0, p3), pointSegmentDistance(p2, p0, p3));
    if (depth >= maxDepth || flatness <= tolerance) {
      push(p3);
      return;
    }
    const p01 = midpoint(p0, p1), p12 = midpoint(p1, p2), p23 = midpoint(p2, p3);
    const p012 = midpoint(p01, p12), p123 = midpoint(p12, p23);
    const p0123 = midpoint(p012, p123);
    flattenCubic(p0, p01, p012, p0123, depth + 1);
    flattenCubic(p0123, p123, p23, p3, depth + 1);
  };
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const appendArc = (command, ellipse = false) => {
    const cx = command.x, cy = command.y;
    const rx = ellipse ? command.radiusX : command.radius;
    const ry = ellipse ? command.radiusY : command.radius;
    const rotation = ellipse ? command.rotation : 0;
    const ccw = Boolean(command.counterclockwise);
    const tau = Math.PI * 2;
    let sweep = command.endAngle - command.startAngle;
    if (!ccw) {
      if (sweep >= tau) sweep = tau;
      else { while (sweep < 0) sweep += tau; }
    } else {
      if (sweep <= -tau) sweep = -tau;
      else { while (sweep > 0) sweep -= tau; }
    }
    const pointAt = (angle) => {
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const cr = Math.cos(rotation), sr = Math.sin(rotation);
      return {
        x: cx + rx * cos * cr - ry * sin * sr,
        y: cy + rx * cos * sr + ry * sin * cr
      };
    };
    const arcStart = pointAt(command.startAngle);
    if (!current) push(arcStart);
    else if (distance(current, arcStart) > epsilon) push(arcStart);
    const radius = Math.max(rx, ry);
    const maxAngle = radius <= tolerance ? Math.PI / 2 :
      Math.max(0.01, 2 * Math.acos(Math.max(-1, Math.min(1, 1 - tolerance / radius))));
    const segments = Math.max(1, Math.min(4096, Math.ceil(Math.abs(sweep) / maxAngle)));
    for (let i = 1; i <= segments; i++) {
      push(pointAt(command.startAngle + sweep * i / segments));
    }
  };

  for (const command of geometry.commands) {
    switch (command.type) {
      case "moveTo":
        finish();
        push({ x: command.x, y: command.y });
        break;
      case "lineTo":
        if (!current) throw new TypeError("lineTo requires a current point.");
        push({ x: command.x, y: command.y });
        break;
      case "quadraticCurveTo":
        if (!current) throw new TypeError("quadraticCurveTo requires a current point.");
        flattenQuadratic(current, { x: command.cpx, y: command.cpy }, { x: command.x, y: command.y });
        break;
      case "bezierCurveTo":
        if (!current) throw new TypeError("bezierCurveTo requires a current point.");
        flattenCubic(current, { x: command.cp1x, y: command.cp1y },
          { x: command.cp2x, y: command.cp2y }, { x: command.x, y: command.y });
        break;
      case "arc":
      case "ellipse":
        appendArc(command, command.type === "ellipse");
        break;
      case "closePath":
        if (points?.length) {
          if (distance(current, start) > epsilon) points.push({ x: start.x, y: start.y });
          current = start;
          closed = true;
        }
        break;
      default:
        throw new TypeError(`Unsupported path command: ${command.type}`);
    }
  }
  finish();
  return result;
}

/** Return only closed subpaths, preserving ring order for even-odd collision tests. */
export function pathGeometryToCollisionPolygons(geometry, options) {
  return flattenPathGeometry(geometry, options)
    .filter((subpath) => subpath.closed && subpath.points.length >= 4)
    .map((subpath) => ({ points: subpath.points, closed: true }));
}

/** Convert shared path data to Path2D where the browser supports it. */
export function pathGeometryToPath2D(geometry) {
  if (typeof Path2D === "undefined") {
    throw new Error("Path2D is not available in this environment.");
  }
  const path = new Path2D();
  appendPathGeometry(path, geometry);
  return path;
}

/** Adapt an existing polygon to the shared path representation. */
export function polygonPathGeometry(points) {
  if (!Array.isArray(points) || points.length < 3) {
    throw new TypeError("A closed polygon path requires at least three points.");
  }
  const vertices = points.map(toPoint);
  return createPathGeometry([
    { type: "moveTo", x: vertices[0].x, y: vertices[0].y },
    ...vertices.slice(1).map((point) => ({ type: "lineTo", x: point.x, y: point.y })),
    { type: "closePath" }
  ]);
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
export function buildWall({ id, points, path: sourcePath = null, radius = 0, segments = 2, gate = false, style = "stone" }) {
  const legacyVerts = points ? roundPolygon(points, radius, segments) : [];
  const path = sourcePath || polygonPathGeometry(legacyVerts);
  const collisionPolygons = pathGeometryToCollisionPolygons(path);
  if (!collisionPolygons.length) {
    throw new TypeError("A wall requires at least one closed path subpath.");
  }
  const allVertices = collisionPolygons.flatMap((ring) => ring.points);
  const box = polygonBounds(allVertices);
  const verts = collisionPolygons[0].points;
  return {
    id, gate, style,
    x: box.x, y: box.y, w: box.w, h: box.h,
    points: verts.map((v) => [v.x - box.x, v.y - box.y]),
    verts,
    path,
    collisionPolygons
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
  tracePathGeometry(ctx, wall.path);
  ctx.fillStyle = cssLinearGradient(ctx, wall.x, wall.y, wall.w, wall.h, style.angle, style.stops);
  ctx.fill();
  ctx.clip();
  ctx.lineJoin = "round";
  // Inner rim light and border both follow every edge of the polygon,
  // including a concave inner corner, so no edge looks "cut out".
  tracePathGeometry(ctx, wall.path);
  ctx.strokeStyle = "rgba(233,245,218,0.10)";
  ctx.lineWidth = 10;
  ctx.stroke();
  tracePathGeometry(ctx, wall.path);
  ctx.strokeStyle = style.border;
  ctx.lineWidth = 4; // clipped to the polygon: 2px visible inside the edge
  ctx.stroke();
  ctx.restore();
}

export function drawGate(ctx, gate) {
  ctx.save();
  tracePathGeometry(ctx, gate.path);
  ctx.clip();
  ctx.fillStyle = "#8c8165";
  ctx.fillRect(gate.x, gate.y, gate.w, gate.h);
  for (let x = gate.x + 3; x < gate.x + gate.w; x += 20) {
    ctx.fillStyle = "#8c8165"; ctx.fillRect(x, gate.y, 10.5, gate.h);
    ctx.fillStyle = "#c0b48b"; ctx.fillRect(x + 10.5, gate.y, 4, gate.h);
    ctx.fillStyle = "#655f4e"; ctx.fillRect(x + 14.5, gate.y, 5.5, gate.h);
  }
  ctx.lineJoin = "round";
  tracePathGeometry(ctx, gate.path);
  ctx.shadowColor = "rgba(236,212,146,0.55)";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "rgba(236,212,146,0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  tracePathGeometry(ctx, gate.path);
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
  // Soft outer halo.
  tracePolygon(ctx, verts);
  ctx.shadowColor = "rgba(54,178,204,0.5)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "rgba(54,178,204,0.12)";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  tracePolygon(ctx, verts);
  ctx.fillStyle = cssLinearGradient(ctx, area.x, area.y, area.w, area.h, 145, [
    [0, "rgba(61,164,183,0.82)"], [0.58, "rgba(22,91,119,0.9)"], [1, "rgba(12,57,82,0.94)"]
  ]);
  ctx.fill();
  ctx.clip();

  // Inner glow and static ripple lines (clipped to the shoreline).
  ctx.lineJoin = "round";
  tracePolygon(ctx, verts);
  ctx.shadowColor = "rgba(180,245,245,0.55)";
  ctx.shadowBlur = 28;
  ctx.strokeStyle = "rgba(180,245,245,0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

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
  ctx.shadowColor = "#082d3a";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
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
    ctx.shadowColor = "#26090b";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = "#fff0e8";
    const cx = zone.x + zone.w / 2, cy = zone.y + zone.h / 2;
    if (zone.label) {
      ctx.font = `800 13px ${FONT}`;
      setLetterSpacing(ctx, 1.56);
      ctx.fillText(zone.label, cx + 0.78, cy - 9);
    }
    if (zone.note) {
      ctx.font = `11px ${FONT}`;
      setLetterSpacing(ctx, 0);
      ctx.fillText(zone.note, cx, cy + 9);
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
