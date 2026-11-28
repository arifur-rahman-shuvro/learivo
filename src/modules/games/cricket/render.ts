import { BATSMAN, type Vec } from "./config.ts";
import type { View } from "./engine.ts";
import type { Quality } from "./storage.ts";

/*
 * Draws one frame on a canvas from a `View`. It only reads the view: no rules live here.
 * The canvas is a fixed 360 x 560 picture that the page scales to fit.
 */
export const W = 360;
export const H = 560;
const CX = 180;
const CY = 300;
const R = 170;

const X = (x: number) => CX + x * R;
const Y = (y: number) => CY + y * R;

const CROWD_COLORS = ["#ff6b6b", "#ffd166", "#4cc9f0", "#f1f1f1", "#b794f6", "#ff9f43"];
const CONFETTI = ["#ffd23f", "#ff5d73", "#4cc9f0", "#ffffff", "#7bd88f"];

interface Dot {
  x: number;
  y: number;
  c: string;
}
/** The crowd is the same every frame, so it is worked out once. */
const crowd: Dot[] = (() => {
  const dots: Dot[] = [];
  for (let i = 0; i < 520; i++) {
    const a = (i * 2.399963) % (Math.PI * 2); // spread evenly
    const r = R * (1.1 + 0.34 * (((i * 37) % 100) / 100));
    const x = CX + Math.cos(a) * r;
    const y = CY + Math.sin(a) * r;
    if (x < 4 || x > W - 4 || y < 4 || y > H - 4) continue;
    dots.push({ x, y, c: CROWD_COLORS[i % CROWD_COLORS.length]! });
  }
  return dots;
})();

const hash = (i: number) => {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawGround(ctx: CanvasRenderingContext2D, high: boolean, boom: number) {
  ctx.fillStyle = "#1c2540";
  ctx.fillRect(-W, -H, W * 3, H * 3);
  // The crowd leaps a little when there is a boundary.
  for (const d of crowd) {
    const jump =
      high && boom > 0 ? Math.sin(d.x * 0.7 + boom * 14) * 2.5 * Math.min(1, boom * 4) : 0;
    ctx.fillStyle = d.c;
    ctx.fillRect(d.x - 1.5, d.y - 1.5 + jump, 3, 3);
  }
  // Mown stripes: alternating rings of grass.
  circle(ctx, CX, CY, R, "#3a9150");
  for (let i = 0; i < 6; i += 2) {
    ctx.beginPath();
    ctx.arc(CX, CY, R * (1 - i / 6), 0, Math.PI * 2);
    ctx.arc(CX, CY, R * (1 - (i + 1) / 6), 0, Math.PI * 2, true);
    ctx.fillStyle = "#44a05a";
    ctx.fill();
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.arc(CX, CY, R * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // The rope.
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPitch(ctx: CanvasRenderingContext2D, v: View) {
  ctx.fillStyle = "#d9b673";
  ctx.fillRect(X(-0.07), Y(-0.52), R * 0.14, R * 1.0);
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1.5;
  for (const y of [-0.44, 0.3]) {
    ctx.beginPath();
    ctx.moveTo(X(-0.09), Y(y));
    ctx.lineTo(X(0.09), Y(y));
    ctx.stroke();
  }
  stumps(ctx, 0, -0.5, 0);
  stumps(ctx, 0, 0.4, v.stumpsDown);
}

/** Three stumps; once bowled they fly apart. */
function stumps(ctx: CanvasRenderingContext2D, x: number, y: number, down: number) {
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  for (let i = -1; i <= 1; i++) {
    const fly = down * (6 + hash(i + 5) * 8);
    const ang = down * (i * 0.9 + 0.3);
    const bx = X(x) + i * 4 + i * fly * 0.6;
    const by = Y(y) + down * hash(i + 9) * 6;
    ctx.strokeStyle = down > 0 ? "#ffcf5c" : "#f8f3e6";
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.sin(ang) * 9, by - Math.cos(ang) * 9);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

function person(ctx: CanvasRenderingContext2D, p: Vec, body: string, r: number, high: boolean) {
  if (high) {
    ctx.beginPath();
    ctx.ellipse(X(p.x) + 1.5, Y(p.y) + 3, r * 1.1, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fill();
  }
  circle(ctx, X(p.x), Y(p.y), r, body);
  circle(ctx, X(p.x), Y(p.y) - r * 0.55, r * 0.5, "#f1c7a0");
}

function drawBatter(ctx: CanvasRenderingContext2D, v: View, high: boolean) {
  const bx = BATSMAN.x - 0.11;
  const by = BATSMAN.y + 0.04;
  person(ctx, { x: bx, y: by }, "#2f6fe4", 8, high);
  // The bat sweeps from raised (up and left) round to the right as the swing goes on.
  const ang = -2.4 + v.swing * 2.8;
  const hx = X(bx) + 5;
  const hy = Y(by) - 2;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#8a5a2b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx + Math.cos(ang) * 11, hy + Math.sin(ang) * 11);
  ctx.stroke();
  ctx.strokeStyle = "#e8c27a";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(hx + Math.cos(ang) * 11, hy + Math.sin(ang) * 11);
  ctx.lineTo(hx + Math.cos(ang) * 29, hy + Math.sin(ang) * 29);
  ctx.stroke();
  ctx.lineCap = "butt";
}

function drawBall(ctx: CanvasRenderingContext2D, v: View, high: boolean) {
  const b = v.ball;
  if (!b.visible) return;
  const x = X(b.x);
  const gy = Y(b.y);
  const size = 4.2 + 2.2 * Math.min(1, Math.max(0, (b.y + 0.42) / 0.68)) + b.h * 3;
  if (high) {
    ctx.beginPath();
    ctx.ellipse(x, gy + 2, size * (1 - b.h * 0.3), size * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
  }
  const by = gy - b.h * 42;
  circle(ctx, x, by, size, "#d62828");
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, by, size * 0.62, 0.4, 2.6);
  ctx.stroke();
}

/** Confetti for a boundary, sparks for a wicket. Positions come from the time since the result. */
function drawBurst(ctx: CanvasRenderingContext2D, v: View) {
  const o = v.outcome;
  if (!o || v.sinceResult <= 0 || v.sinceResult > 1200) return;
  const tau = v.sinceResult / 1000;
  const six = o.kind === "six";
  const four = o.kind === "four";
  if (!six && !four && !o.out) return;
  const ox = o.out ? X(0) : six ? X(0) : X(v.ball.x);
  const oy = o.out ? Y(0.38) : six ? Y(-0.2) : Y(v.ball.y);
  const n = six ? 34 : 18;
  for (let i = 0; i < n; i++) {
    const a = hash(i) * Math.PI * 2;
    const sp = 40 + hash(i + 50) * (six ? 150 : 90);
    const x = ox + Math.cos(a) * sp * tau;
    const y = oy + Math.sin(a) * sp * tau + 120 * tau * tau;
    ctx.globalAlpha = Math.max(0, 1 - tau / 1.2);
    ctx.fillStyle = o.out ? (i % 2 ? "#ff5d73" : "#ffffff") : CONFETTI[i % CONFETTI.length]!;
    ctx.fillRect(x, y, 4, 4);
  }
  ctx.globalAlpha = 1;
}

/** How close the camera is to the pitch: while the ball is coming it zooms in, after the hit it pulls back. */
export const ZOOM = 1.9;
const smooth = (t: number) => t * t * (3 - 2 * t);
export function zoomAt(v: Pick<View, "phase" | "sincePlay" | "sinceReady">): number {
  const k =
    v.phase === "bowling" || v.phase === "swung"
      ? 1
      : v.phase === "ready"
        ? smooth(Math.min(1, v.sinceReady / 450))
        : v.phase === "play"
          ? 1 - smooth(Math.min(1, v.sincePlay / 450))
          : 0;
  return 1 + (ZOOM - 1) * k;
}

export function draw(ctx: CanvasRenderingContext2D, v: View, quality: Quality, clock: number) {
  const high = quality === "high";
  ctx.save();
  const z = zoomAt(v);
  const k = (z - 1) / (ZOOM - 1);
  // Camera: the picture's middle slides from the whole ground to the pitch as it zooms in.
  const fx = CX + (X(0) - CX) * k;
  const fy = CY + (Y(-0.02) - CY) * k;
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.translate(-fx, -fy);
  // A small shake on a six or a wicket.
  const o = v.outcome;
  const boom =
    o && (o.kind === "six" || o.out || o.kind === "four") && v.sinceResult > 0
      ? v.sinceResult / 1000
      : 0;
  if (high && o && (o.kind === "six" || o.out) && v.sincePlay > 0 && boom < 0.35) {
    ctx.translate(
      Math.sin(clock * 0.09) * 3 * (1 - boom * 2.8),
      Math.cos(clock * 0.11) * 2 * (1 - boom * 2.8),
    );
  }
  drawGround(ctx, high, boom);
  drawPitch(ctx, v);

  // The timing ring where the ball meets the bat: it pulses while the ball is coming.
  const coming = v.phase === "bowling" || v.phase === "swung";
  ctx.strokeStyle = coming ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.arc(
    X(BATSMAN.x),
    Y(BATSMAN.y),
    13 + (coming ? Math.sin(clock * 0.012) * 1.5 : 0),
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.setLineDash([]);

  person(ctx, { x: 0, y: 0.5 }, "#8a5cf6", 6.5, high);
  for (let i = 0; i < v.fielders.length; i++) person(ctx, v.fielders[i]!, "#ffd23f", 6.5, high);
  person(ctx, v.bowler, "#e24a3b", 7, high);
  if (!v.released) circle(ctx, X(v.bowler.x) + 5, Y(v.bowler.y) - 3, 2.6, "#d62828");
  drawBatter(ctx, v, high);
  drawBall(ctx, v, high);
  if (high) drawBurst(ctx, v);
  ctx.restore();
}
