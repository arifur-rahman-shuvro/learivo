import { BALL_R, HEIGHT, PADDLE, PADDLE_Y, WIDTH, type Theme } from "./config.ts";
import type { View } from "./game.ts";
import type { Quality } from "./storage.ts";

/*
 * Draws one frame from a `View`. It only reads the view: no rules live here. The picture is a fixed
 * 360 x 600 canvas that the page scales to fit; the table sits inside it with a margin for the glow.
 */
export const W = 360;
export const H = 600;
export const TX = 20;
export const TY = 44;
export const TW = 320;
export const TH = TW * (HEIGHT / WIDTH);

const px = (x: number) => TX + x * TW;
const py = (y: number) => TY + y * TW;

/** Canvas position (0..W, 0..H) -> table x (0..1). Used by the touch layer. */
export const tableX = (cx: number) => (cx - TX) / TW;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTable(ctx: CanvasRenderingContext2D, v: View, t: Theme, high: boolean) {
  // The table, with a darker lower half so the two ends are easy to tell apart.
  ctx.save();
  if (high) {
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
  }
  roundRect(ctx, TX, TY, TW, TH, 14);
  ctx.fillStyle = t.table;
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, TX, TY, TW, TH, 14);
  ctx.clip();
  ctx.fillStyle = t.tableAlt;
  ctx.fillRect(TX, py(HEIGHT / 2), TW, TH / 2);
  // The point just won tints the end it was won at.
  if (v.phase === "point" && v.pointWinner !== null) {
    const a = Math.max(0, 0.3 - v.phaseTime * 0.22);
    ctx.globalAlpha = a;
    ctx.fillStyle = v.pointWinner === 0 ? t.p0 : t.p1;
    if (v.pointWinner === 0) ctx.fillRect(TX, py(HEIGHT / 2), TW, TH / 2);
    else ctx.fillRect(TX, TY, TW, TH / 2);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // White lines.
  ctx.strokeStyle = t.line;
  ctx.lineWidth = 3;
  roundRect(ctx, TX + 6, TY + 6, TW - 12, TH - 12, 10);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.6;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(px(0.5), TY + 6);
  ctx.lineTo(px(0.5), TY + TH - 6);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // The net.
  const ny = py(HEIGHT / 2);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(TX - 6, ny - 3, TW + 12, 6);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(TX - 6, ny);
  ctx.lineTo(TX + TW + 6, ny);
  ctx.stroke();
  ctx.fillStyle = t.line;
  for (const x of [TX - 6, TX + TW + 6]) {
    ctx.beginPath();
    ctx.arc(x, ny, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPaddle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  top: boolean,
  high: boolean,
) {
  const w = PADDLE.halfW * 2 * TW;
  const h = PADDLE.halfT * 2 * TW;
  const cx = px(x);
  const cy = py(y);
  if (high) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    roundRect(ctx, cx - w / 2 + 2, cy - h / 2 + 5, w, h, h / 2);
    ctx.fill();
  }
  // The handle points away from the net.
  ctx.fillStyle = "#c9a36a";
  roundRect(ctx, cx - 5, top ? cy - h / 2 - 16 : cy + h / 2 - 2, 10, 18, 4);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  roundRect(ctx, cx - w / 2 + 6, cy - h / 2 + 2, w - 12, 3, 1.5);
  ctx.fill();
}

function drawWall(ctx: CanvasRenderingContext2D, t: Theme) {
  const y = py(PADDLE_Y[1]) - 8;
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  roundRect(ctx, TX + 4, y - 6, TW - 8, 16, 6);
  ctx.fill();
  ctx.strokeStyle = t.line;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  for (let x = TX + 24; x < TX + TW - 8; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, y + 10);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawBall(ctx: CanvasRenderingContext2D, v: View, t: Theme, high: boolean) {
  if (!v.ball.visible) return;
  const x = px(v.ball.x);
  const y = py(v.ball.y);
  const r = BALL_R * TW;
  // The trail grows longer and brighter as the ball speeds up.
  const n = v.trail.length;
  for (let i = 0; i < n; i++) {
    const p = v.trail[i]!;
    const k = (i + 1) / n;
    ctx.globalAlpha = k * (0.15 + 0.4 * v.speed);
    ctx.fillStyle = t.ball;
    ctx.beginPath();
    ctx.arc(px(p.x), py(p.y), r * (0.35 + 0.6 * k), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (high) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 4, r, r * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.4);
    g.addColorStop(0, `${t.ball}66`);
    g.addColorStop(1, `${t.ball}00`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = t.ball;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // A curve mark when the ball has spin.
  if (Math.abs(v.ball.spin) > 0.35) {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      r * 1.55,
      v.ball.spin > 0 ? -0.9 : Math.PI - 0.9,
      v.ball.spin > 0 ? 0.9 : Math.PI + 0.9,
    );
    ctx.stroke();
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, v: View, t: Theme) {
  for (const f of v.effects) {
    const k = Math.min(1, f.age / 0.55);
    const x = px(f.x);
    const y = py(f.y);
    ctx.globalAlpha = 1 - k;
    if (f.kind === "wall") {
      ctx.strokeStyle = t.line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 4 + 10 * k, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    const color = f.player === 1 ? t.p1 : t.p0;
    ctx.strokeStyle = f.perfect ? "#ffd23f" : color;
    ctx.lineWidth = f.smash ? 4 : 3;
    ctx.beginPath();
    ctx.arc(x, y, 8 + (f.smash ? 40 : 28) * k, 0, Math.PI * 2);
    ctx.stroke();
    if (f.perfect) {
      // Eight rays for a perfect hit.
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.moveTo(x + Math.cos(a) * (10 + 10 * k), y + Math.sin(a) * (10 + 10 * k));
        ctx.lineTo(x + Math.cos(a) * (18 + 22 * k), y + Math.sin(a) * (18 + 22 * k));
      }
      ctx.stroke();
    }
    if (f.smash) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 4 + 22 * k, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function drawCount(ctx: CanvasRenderingContext2D, v: View, t: Theme) {
  if (v.phase !== "countdown" || v.count <= 0) return;
  const stepT = (v.phaseTime % 0.8) / 0.8;
  const s = 1.5 - 0.5 * Math.min(1, stepT * 3);
  ctx.save();
  ctx.translate(W / 2, TY + TH / 2);
  ctx.scale(s, s);
  ctx.globalAlpha = 1 - stepT * stepT * 0.6;
  ctx.font = "900 120px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.strokeText(String(v.count), 0, 0);
  ctx.fillStyle = t.line;
  ctx.fillText(String(v.count), 0, 0);
  ctx.restore();
}

function drawRally(ctx: CanvasRenderingContext2D, v: View, t: Theme) {
  if (v.phase === "rally" && v.rally >= 3) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.font = "900 84px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = t.line;
    ctx.fillText(String(v.rally), W / 2, TY + TH * 0.27);
    ctx.restore();
  }
  // Ball speed: a thin bar down the right side.
  const bh = TH * 0.5;
  const bx = TX + TW + 8;
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  roundRect(ctx, bx, TY + TH / 2 - bh / 2, 4, bh, 2);
  ctx.fill();
  const fill = bh * v.speed;
  ctx.fillStyle = v.speed > 0.8 ? "#ff6b6b" : t.ball;
  roundRect(ctx, bx, TY + TH / 2 + bh / 2 - fill, 4, Math.max(2, fill), 2);
  ctx.fill();
}

export function draw(
  ctx: CanvasRenderingContext2D,
  v: View,
  t: Theme,
  quality: Quality,
  clock: number,
) {
  const high = quality === "high";
  ctx.save();
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);
  // A smash shakes the picture for a moment.
  const smash = high ? v.effects.find((f) => f.kind === "hit" && f.smash && f.age < 0.18) : null;
  if (smash) ctx.translate(Math.sin(clock * 0.15) * 2.5, Math.cos(clock * 0.19) * 2);
  drawTable(ctx, v, t, high);
  if (v.mode === "practice") drawWall(ctx, t);
  drawBall(ctx, v, t, high);
  if (v.mode !== "practice") drawPaddle(ctx, v.paddles[1], PADDLE_Y[1], t.p1, true, high);
  drawPaddle(ctx, v.paddles[0], PADDLE_Y[0], t.p0, false, high);
  if (high) drawEffects(ctx, v, t);
  drawRally(ctx, v, t);
  drawCount(ctx, v, t);
  ctx.restore();
}
