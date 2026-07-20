// Source model: Fable 5
// 入口：固定步长主循环、DPR/窗口缩放适配、模块装配。

import { Game, VIEW } from './game/game';
import { Renderer } from './game/render';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const game = new Game(window.localStorage);
game.input.attach(window);
const renderer = new Renderer(ctx);

// 暴露给调试/自动化验证使用
(window as unknown as Record<string, unknown>).__stormClocktower = game;

// ---- 缩放适配：逻辑分辨率固定 960x540，按窗口等比缩放并居中 ----
function fitCanvas(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const scale = Math.min(window.innerWidth / VIEW.w, window.innerHeight / VIEW.h);
  canvas.style.width = `${Math.floor(VIEW.w * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.h * scale)}px`;
  canvas.width = Math.floor(VIEW.w * dpr);
  canvas.height = Math.floor(VIEW.h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// ---- 固定步长更新（120Hz 物理），渲染跟随 rAF ----
const STEP = 1 / 120;
let last = performance.now();
let acc = 0;

function frame(now: number): void {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25; // 切后台回来防止暴走
  acc += dt;
  while (acc >= STEP) {
    game.update(STEP);
    acc -= STEP;
  }
  renderer.draw(game, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
