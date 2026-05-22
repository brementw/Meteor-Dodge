const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreText = document.getElementById("scoreText");
const levelText = document.getElementById("levelText");
const messagePanel = document.getElementById("messagePanel");
const messageText = document.getElementById("messageText");
const startButton = document.getElementById("startButton");

const W = canvas.width;
const H = canvas.height;
const lanes = [W * 0.19, W * 0.5, W * 0.81];
const playerY = H - 132;
const bestKey = "rocketMeteorBestScore";

const images = {
  rocket: loadImage("火箭/火箭.png"),
  flame: loadImage("火箭/噴射火.gif"),
  meteor: loadImage("敵人角色/隕石.png"),
  ufo: loadImage("敵人角色/UFO.png"),
  props: [
    loadImage("加分道具/金幣.jpg"),
    loadImage("加分道具/蛋糕.png"),
    loadImage("加分道具/蘋果.jpg")
  ],
  backgrounds: [
    loadImage("場景/太空.jpg"),
    loadImage("場景/宇宙01.jpg"),
    loadImage("場景/宇宙02.jpg"),
    loadImage("場景/宇宙03.jpg"),
    loadImage("場景/宇宙04.jpg"),
    loadImage("場景/宇宙05.jpg"),
    loadImage("場景/宇宙06.jpg"),
    loadImage("場景/宇宙06.png"),
    loadImage("場景/宇宙07.jpg")
  ]
};

const levelTargets = [450, 1050, 1850, 2850, 4100, 5600, 7400, 9500, 12000];
const levelNames = [
  "新手航道",
  "藍色星雲",
  "碎石雨帶",
  "紫光深空",
  "灼熱流星區",
  "高速星門",
  "黑暗警戒線",
  "銀河終點站",
  "最後隕石海"
];

let state = createFreshState();
let lastTime = 0;
let rafId = 0;

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

function createFreshState() {
  return {
    mode: "ready",
    lane: 1,
    score: 0,
    best: Number(localStorage.getItem(bestKey) || 0),
    level: 0,
    speedTime: 0,
    spawnTimer: 0,
    propTimer: 1.2,
    objects: [],
    stars: Array.from({ length: 86 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.9 + 0.5,
      a: Math.random() * 0.65 + 0.25
    })),
    transitionTimer: 0,
    explosionTimer: 0
  };
}

function startGame() {
  state = createFreshState();
  state.mode = "playing";
  messagePanel.classList.remove("is-visible");
  updateHud();
  lastTime = performance.now();
}

function movePlayer(step) {
  if (state.mode !== "playing") return;
  state.lane = Math.max(0, Math.min(2, state.lane + step));
}

function updateHud() {
  scoreText.textContent = Math.floor(state.score).toLocaleString("zh-TW");
  levelText.textContent = state.level + 1;
}

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000 || 0, 0.04);
  lastTime = now;

  update(dt);
  draw(dt);

  rafId = requestAnimationFrame(frame);
}

function update(dt) {
  if (state.mode !== "playing") {
    if (state.mode === "dead") {
      state.explosionTimer += dt;
    }
    return;
  }

  state.speedTime += dt;
  const level = state.level;
  const baseSpeed = 150 + level * 18;
  const timeBoost = Math.min(210, state.speedTime * 3.1);
  const speed = baseSpeed + timeBoost;
  const difficulty = 1 + level * 0.08;

  state.score += dt * (15 + level * 2);
  state.spawnTimer -= dt;
  state.propTimer -= dt;
  state.transitionTimer = Math.max(0, state.transitionTimer - dt);

  if (state.spawnTimer <= 0) {
    spawnEnemy(speed);
    state.spawnTimer = Math.max(0.42, 1.12 - level * 0.065 - state.speedTime * 0.0035);
  }

  if (state.propTimer <= 0) {
    spawnProp(speed);
    state.propTimer = Math.max(1.1, 2.6 - level * 0.09 + Math.random() * 1.3);
  }

  for (const obj of state.objects) {
    obj.y += obj.speed * difficulty * dt;
    obj.spin += obj.spinSpeed * dt;
  }

  const playerBox = { x: lanes[state.lane], y: playerY, r: 43 };
  for (const obj of state.objects) {
    if (obj.hit || obj.y < playerY - 80 || obj.y > playerY + 66) continue;
    const dist = Math.hypot(playerBox.x - obj.x, playerBox.y - obj.y);
    if (dist > playerBox.r + obj.r) continue;

    obj.hit = true;
    if (obj.kind === "prop") {
      state.score += obj.points;
    } else {
      gameOver();
      break;
    }
  }

  state.objects = state.objects.filter((obj) => obj.y < H + 90 && !obj.hit);

  if (state.score >= levelTargets[state.level]) {
    if (state.level < 8) {
      state.level += 1;
      state.transitionTimer = 2.1;
      state.objects = [];
    } else {
      finishGame();
    }
  }

  updateHud();
}

function spawnEnemy(speed) {
  const level = state.level;
  const occupied = new Set(state.objects.filter((obj) => obj.y < 120).map((obj) => obj.lane));
  const lane = pickLane(occupied);
  const isUfo = Math.random() < 0.14 + level * 0.014;
  state.objects.push({
    kind: "enemy",
    type: isUfo ? "ufo" : "meteor",
    img: isUfo ? images.ufo : images.meteor,
    lane,
    x: lanes[lane],
    y: -70,
    size: isUfo ? 70 : 76,
    r: isUfo ? 34 : 36,
    speed: speed + Math.random() * 42 + (isUfo ? 18 : 0),
    spin: Math.random() * Math.PI,
    spinSpeed: isUfo ? 0.4 : (Math.random() * 1.8 - 0.9)
  });
}

function spawnProp(speed) {
  const lane = Math.floor(Math.random() * 3);
  const img = images.props[Math.floor(Math.random() * images.props.length)];
  state.objects.push({
    kind: "prop",
    img,
    lane,
    x: lanes[lane],
    y: -58,
    size: 54,
    r: 27,
    points: 90 + state.level * 20,
    speed: speed * 0.82,
    spin: Math.random() * Math.PI,
    spinSpeed: 1.1
  });
}

function pickLane(occupied) {
  const available = [0, 1, 2].filter((lane) => !occupied.has(lane));
  if (available.length === 0) return Math.floor(Math.random() * 3);
  return available[Math.floor(Math.random() * available.length)];
}

function gameOver() {
  state.mode = "dead";
  state.explosionTimer = 0;
  saveBest();
  setTimeout(() => {
    showMessage(
      "任務失敗",
      `最高分：${state.best.toLocaleString("zh-TW")}。本局分數：${Math.floor(state.score).toLocaleString("zh-TW")}。`,
      "再玩一次"
    );
  }, 850);
}

function finishGame() {
  state.mode = "finished";
  saveBest();
  showMessage(
    "九關全破",
    `最高分：${state.best.toLocaleString("zh-TW")}。你成功穿越最後隕石海，本局分數：${Math.floor(state.score).toLocaleString("zh-TW")}。`,
    "再玩一次"
  );
}

function saveBest() {
  const current = Math.floor(state.score);
  if (current > state.best) {
    state.best = current;
    localStorage.setItem(bestKey, String(current));
  }
}

function showMessage(title, text, buttonLabel) {
  messagePanel.querySelector("h1").textContent = title;
  messageText.textContent = text;
  startButton.textContent = buttonLabel;
  messagePanel.classList.add("is-visible");
}

function draw(dt) {
  drawBackground(dt);
  drawLanes();
  drawObjects();
  drawPlayer();
  drawTransition();
}

function drawBackground(dt) {
  const bg = images.backgrounds[state.level] || images.backgrounds[0];
  if (bg.complete && bg.naturalWidth) {
    const scale = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
    const bw = bg.naturalWidth * scale;
    const bh = bg.naturalHeight * scale;
    ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh);
  } else {
    ctx.fillStyle = "#061430";
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.fillRect(0, 0, W, H);

  const starSpeed = state.mode === "playing" ? 36 + state.level * 6 + state.speedTime * 0.25 : 14;
  for (const star of state.stars) {
    star.y += starSpeed * dt * star.r;
    if (star.y > H + 8) {
      star.y = -8;
      star.x = Math.random() * W;
    }
    ctx.globalAlpha = star.a;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawLanes() {
  ctx.save();
  ctx.strokeStyle = "rgba(105, 233, 255, 0.22)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 18]);
  for (const x of lanes) {
    ctx.beginPath();
    ctx.moveTo(x, 92);
    ctx.lineTo(x, H - 36);
    ctx.stroke();
  }
  ctx.restore();
}

function drawObjects() {
  for (const obj of state.objects) {
    drawImageCentered(obj.img, obj.x, obj.y, obj.size, obj.size, obj.spin);
    if (obj.kind === "prop") {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "#ffd35a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawPlayer() {
  const x = lanes[state.lane];
  const shake = state.mode === "dead" ? Math.sin(state.explosionTimer * 55) * 8 : 0;

  ctx.save();
  ctx.globalAlpha = state.mode === "dead" ? Math.max(0.2, 1 - state.explosionTimer * 1.2) : 1;
  drawImageCentered(images.rocket, x + shake, playerY, 94, 94, 0);

  ctx.translate(x + shake, playerY + 64);
  ctx.rotate(Math.PI);
  const flamePulse = 1 + Math.sin(performance.now() / 80) * 0.08;
  ctx.globalCompositeOperation = "screen";
  drawImageAt(images.flame, -18 * flamePulse, -54, 36 * flamePulse, 50 * flamePulse);
  ctx.restore();

  if (state.mode === "dead") {
    drawExplosion(x + shake, playerY);
  }
}

function drawExplosion(x, y) {
  const t = Math.min(1, state.explosionTimer / 0.9);
  const radius = 22 + t * 84;
  ctx.save();
  ctx.globalAlpha = 1 - t;
  const boom = ctx.createRadialGradient(x, y, 8, x, y, radius);
  boom.addColorStop(0, "#fff4a4");
  boom.addColorStop(0.35, "#ff7a32");
  boom.addColorStop(1, "rgba(255, 40, 80, 0)");
  ctx.fillStyle = boom;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTransition() {
  if (state.transitionTimer <= 0 || state.mode !== "playing") return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.92, state.transitionTimer / 1.1);
  ctx.fillStyle = "rgba(5, 8, 26, 0.72)";
  ctx.fillRect(0, H * 0.37, W, 150);
  ctx.fillStyle = "#ffd35a";
  ctx.font = "900 44px Microsoft JhengHei, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`第 ${state.level + 1} 關`, W / 2, H * 0.45);
  ctx.fillStyle = "#f5fbff";
  ctx.font = "700 22px Microsoft JhengHei, sans-serif";
  ctx.fillText(levelNames[state.level], W / 2, H * 0.51);
  ctx.restore();
}

function drawImageCentered(img, x, y, w, h, rotation) {
  if (!img.complete || !img.naturalWidth) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawImageAt(img, x, y, w, h) {
  if (!img.complete || !img.naturalWidth) return;
  ctx.drawImage(img, x, y, w, h);
}

canvas.addEventListener("contextmenu", (event) => event.preventDefault());

canvas.addEventListener("mousedown", (event) => {
  event.preventDefault();
  if (event.button === 0) movePlayer(-1);
  if (event.button === 2) movePlayer(1);
});

startButton.addEventListener("click", startGame);

window.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && state.mode !== "playing") startGame();
});

showMessage(
  "火箭閃隕石",
  "滑鼠左鍵往左一格，右鍵往右一格。吃道具加分，閃開隕石與 UFO。",
  "開始遊戲"
);
updateHud();
rafId = requestAnimationFrame(frame);
