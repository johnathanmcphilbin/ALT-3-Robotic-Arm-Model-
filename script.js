(function () {
  const canvas = document.getElementById('armCanvas');
  const ctx = canvas.getContext('2d');

  const theta1El = document.getElementById('theta1');
  const theta2El = document.getElementById('theta2');
  const theta3El = document.getElementById('theta3');
  const t1Out = document.getElementById('theta1Value');
  const t2Out = document.getElementById('theta2Value');
  const t3Out = document.getElementById('theta3Value');
  const coordsEl = document.getElementById('coords');
  const modeIndicatorEl = document.getElementById('modeIndicator');
  const scoreEl = document.getElementById('score');
  const missesEl = document.getElementById('misses');
  const difficultyEl = document.getElementById('difficulty');
  const difficultyOut = document.getElementById('difficultyValue');
  const gameModeEl = document.getElementById('gameMode');

  // Link lengths in pixels (tweak as desired)
  const linkLengths = [120, 100, 80];
  const totalReach = linkLengths[0] + linkLengths[1] + linkLengths[2];

  // Control mode: 'sliders' or 'mouse'
  let controlMode = 'sliders';

  // Mouse target in math space (y up), null when not active
  let mouseTarget = null;

  // Base horizontal offset (in math coords)
  let baseX = 0;
  const baseMoveSpeed = 240; // px/s
  const keysDown = new Set();

  // Score / mistakes
  let score = 0;
  let misses = 0;

  // Balls list (used by both modes)
  const balls = [];
  let spawnAccumulator = 0; // for bucket mode

  // Bucket (bucket mode)
  const bucket = { x: 200, y: 40, w: 120, h: 60 };

  // Basketball (hoop and a ball you can shoot)
  const hoop = { x: 220, y: 160, r: 22 }; // simple ring target
  let heldBall = null; // ball attached to end-effector before shot

  // Timing
  let lastTs = 0;

  function degToRad(deg) { return (deg * Math.PI) / 180; }
  function radToDeg(rad) { return (rad * 180) / Math.PI; }
  function wrapPi(a) { while (a <= -Math.PI) a += Math.PI * 2; while (a > Math.PI) a -= Math.PI * 2; return a; }
  function wrap360Deg(v) { let x = v % 360; if (x < 0) x += 360; return x; }

  function getAnglesDeg() { return [Number(theta1El.value), Number(theta2El.value), Number(theta3El.value)]; }
  function setAnglesDeg([a, b, c]) { theta1El.value = String(wrap360Deg(a)); theta2El.value = String(wrap360Deg(b)); theta3El.value = String(wrap360Deg(c)); updateOutputs(); }
  function getAnglesRad() { return getAnglesDeg().map(degToRad); }
  function setAnglesRad([a, b, c]) { setAnglesDeg([radToDeg(a), radToDeg(b), radToDeg(c)]); }

  function forwardKinematics(anglesDeg) {
    const [t1, t2, t3] = anglesDeg.map(degToRad);
    const [L1, L2, L3] = linkLengths;
    const x1 = baseX + L1 * Math.cos(t1); const y1 = 0 + L1 * Math.sin(t1);
    const t12 = t1 + t2; const x2 = x1 + L2 * Math.cos(t12); const y2 = y1 + L2 * Math.sin(t12);
    const t123 = t12 + t3; const x3 = x2 + L3 * Math.cos(t123); const y3 = y2 + L3 * Math.sin(t123);
    return [ { x: baseX, y: 0 }, { x: x1, y: y1 }, { x: x2, y: y2 }, { x: x3, y: y3 } ];
  }

  function getCanvasMetrics() { const rect = canvas.getBoundingClientRect(); const cx = rect.width / 2; const cy = rect.height * 0.75; return { rect, cx, cy }; }
  function mathToCanvas(p) { const { cx, cy } = getCanvasMetrics(); return { x: cx + p.x, y: cy - p.y }; }
  function canvasToMath(p) { const { cx, cy } = getCanvasMetrics(); return { x: p.x - cx, y: cy - p.y }; }
  function setCanvasPixelRatio() { const dpr = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect(); canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

  function drawArm(points) {
    drawGrid();
    const cPoints = points.map(mathToCanvas);
    ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(96, 165, 250, 0.95)';
    ctx.beginPath(); ctx.moveTo(cPoints[0].x, cPoints[0].y); for (let i = 1; i < cPoints.length; i++) { ctx.lineTo(cPoints[i].x, cPoints[i].y); } ctx.stroke();
    for (let i = 0; i < cPoints.length; i++) { ctx.fillStyle = i === cPoints.length - 1 ? '#fbbf24' : '#e5e7eb'; ctx.beginPath(); ctx.arc(cPoints[i].x, cPoints[i].y, i === 0 ? 6 : 5, 0, Math.PI * 2); ctx.fill(); }
    if (mouseTarget && controlMode === 'mouse') { const m = mathToCanvas(mouseTarget); ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(m.x, m.y, 8, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(m.x - 10, m.y); ctx.lineTo(m.x + 10, m.y); ctx.moveTo(m.x, m.y - 10); ctx.lineTo(m.x, m.y + 10); ctx.stroke(); }
    drawBucket();
    drawHoop();
  }

  function drawGrid() {
    const { rect, cx, cy } = getCanvasMetrics(); const ctx2 = ctx; ctx2.save(); ctx2.strokeStyle = 'rgba(148, 163, 184, 0.15)'; ctx2.lineWidth = 1; const spacing = 40;
    for (let x = 0; x <= rect.width; x += spacing) { ctx2.beginPath(); ctx2.moveTo(x, 0); ctx2.lineTo(x, rect.height); ctx2.stroke(); }
    for (let y = 0; y <= rect.height; y += spacing) { ctx2.beginPath(); ctx2.moveTo(0, y); ctx2.lineTo(rect.width, y); ctx2.stroke(); }
    ctx2.strokeStyle = 'rgba(99, 102, 241, 0.5)'; ctx2.beginPath(); ctx2.moveTo(0, cy); ctx2.lineTo(rect.width, cy); ctx2.moveTo(cx + baseX, 0); ctx2.lineTo(cx + baseX, rect.height); ctx2.stroke(); ctx2.restore();
  }

  function drawBucket() {
    const topLeft = mathToCanvas({ x: bucket.x - bucket.w / 2, y: bucket.y + bucket.h / 2 });
    const topRight = mathToCanvas({ x: bucket.x + bucket.w / 2, y: bucket.y + bucket.h / 2 });
    const bottomLeft = mathToCanvas({ x: bucket.x - bucket.w / 2, y: bucket.y - bucket.h / 2 });
    const bottomRight = mathToCanvas({ x: bucket.x + bucket.w / 2, y: bucket.y - bucket.h / 2 });
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y); ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.moveTo(topRight.x, topRight.y); ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.moveTo(bottomLeft.x, bottomLeft.y); ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.stroke();
  }

  function drawHoop() {
    // Hoop is a circle; scoring if ball passes through interior height range
    const c = mathToCanvas({ x: hoop.x, y: hoop.y });
    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(c.x, c.y, hoop.r, 0, Math.PI * 2); ctx.stroke();
  }

  function updateOutputs() {
    t1Out.textContent = `${wrap360Deg(Number(theta1El.value))}°`;
    t2Out.textContent = `${wrap360Deg(Number(theta2El.value))}°`;
    t3Out.textContent = `${wrap360Deg(Number(theta3El.value))}°`;
    if (difficultyEl && difficultyOut) { const r = Number(difficultyEl.value); difficultyOut.textContent = `${r} balls/sec`; }
  }

  function updateHUD() { if (scoreEl) scoreEl.textContent = String(score); if (missesEl) missesEl.textContent = String(misses); }
  function updateCoordsDisplay(points) { const end = points[points.length - 1]; coordsEl.textContent = `End Effector: (x: ${end.x.toFixed(1)}, y: ${end.y.toFixed(1)})`; }

  function clampTargetToWorkspace(t) { const dx = t.x - baseX; const dy = t.y - 0; const d = Math.hypot(dx, dy); const maxR = totalReach - 1; const minR = 0; if (d < 1e-3) return { x: baseX, y: 0 }; const clampedR = Math.max(minR, Math.min(maxR, d)); if (clampedR === d) return t; const s = clampedR / d; return { x: baseX + dx * s, y: 0 + dy * s }; }

  function solveIKCCD(target, iterations = 14, tolerance = 0.4) {
    const [L1, L2, L3] = linkLengths; const tgt = clampTargetToWorkspace(target);
    const rel = getAnglesRad(); let abs1 = wrapPi(rel[0]); let abs2 = wrapPi(rel[0] + rel[1]); let abs3 = wrapPi(rel[0] + rel[1] + rel[2]);
    function jointsFromAbs(a1, a2, a3) { const p0 = { x: baseX, y: 0 }; const p1 = { x: p0.x + L1 * Math.cos(a1), y: p0.y + L1 * Math.sin(a1) }; const p2 = { x: p1.x + L2 * Math.cos(a2), y: p1.y + L2 * Math.sin(a2) }; const p3 = { x: p2.x + L3 * Math.cos(a3), y: p2.y + L3 * Math.sin(a3) }; return [p0, p1, p2, p3]; }
    function angleBetween(v1, v2) { const dot = v1.x * v2.x + v1.y * v2.y; const det = v1.x * v2.y - v1.y * v2.x; return Math.atan2(det, dot); }
    for (let iter = 0; iter < iterations; iter++) {
      let [p0, p1, p2, p3] = jointsFromAbs(abs1, abs2, abs3);
      const dx = tgt.x - p3.x; const dy = tgt.y - p3.y; if (Math.hypot(dx, dy) < tolerance) break;
      let v3 = { x: p3.x - p2.x, y: p3.y - p2.y }; let vt = { x: tgt.x - p2.x, y: tgt.y - p2.y }; abs3 = wrapPi(abs3 + angleBetween(v3, vt));
      ;[p0, p1, p2, p3] = jointsFromAbs(abs1, abs2, abs3);
      v3 = { x: p3.x - p1.x, y: p3.y - p1.y }; vt = { x: tgt.x - p1.x, y: tgt.y - p1.y }; abs2 = wrapPi(abs2 + angleBetween(v3, vt));
      ;[p0, p1, p2, p3] = jointsFromAbs(abs1, abs2, abs3);
      v3 = { x: p3.x - p0.x, y: p3.y - p0.y }; vt = { x: tgt.x - p0.x, y: tgt.y - p0.y }; abs1 = wrapPi(abs1 + angleBetween(v3, vt));
    }
    const r1 = wrapPi(abs1); const r2 = wrapPi(abs2 - abs1); const r3 = wrapPi(abs3 - abs2); setAnglesRad([r1, r2, r3]);
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function updateOnce() { updateOutputs(); updateHUD(); const points = forwardKinematics(getAnglesDeg()); clear(); drawArm(points); drawBalls(); updateCoordsDisplay(points); }

  function drawBalls() { for (const b of balls) { const c = mathToCanvas({ x: b.x, y: b.y }); ctx.fillStyle = b.stuckUntil && nowSec() < b.stuckUntil ? '#cbd5e1' : '#9ca3af'; ctx.beginPath(); ctx.arc(c.x, c.y, b.radius, 0, Math.PI * 2); ctx.fill(); } if (heldBall) { const c = mathToCanvas({ x: heldBall.x, y: heldBall.y }); ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(c.x, c.y, heldBall.radius, 0, Math.PI * 2); ctx.fill(); } }

  function nowSec() { return performance.now() / 1000; }

  function stepBallsBucket(dt, points) {
    const gravity = -900; const floorY = 0; const damping = 0.98;
    for (const b of balls) {
      const stuckActive = b.stuckUntil && nowSec() < b.stuckUntil; if (!stuckActive) { b.vy += gravity * dt; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y - b.radius <= floorY) { b.dead = true; misses++; continue; }
      if (ballInBucket(b)) { b.dead = true; score++; continue; }
      resolveBallArmCollision(b, points);
    }
    // Ball-ball separation
    separateBalls(balls, damping);
    for (let i = balls.length - 1; i >= 0; i--) { if (balls[i].dead) balls.splice(i, 1); }
  }

  function stepBallsBasketball(dt, points) {
    const gravity = -900; const floorY = 0; const damping = 0.98;
    // Move held ball to end-effector
    if (heldBall) {
      const end = points[points.length - 1];
      heldBall.x = end.x; heldBall.y = end.y;
    }
    for (const b of balls) {
      b.vy += gravity * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y - b.radius <= floorY) { b.dead = true; misses++; continue; }
      if (ballThroughHoop(b)) { b.dead = true; score++; continue; }
      // Backboard/hoop collision as a soft circle
      const dx = b.x - hoop.x; const dy = b.y - hoop.y; const dist = Math.hypot(dx, dy); const minD = b.radius + hoop.r;
      if (dist < minD) { const nx = dx / (dist || 1), ny = dy / (dist || 1); const push = (minD - dist) + 0.5; b.x += nx * push; b.y += ny * push; b.vx *= 0.8; b.vy *= -0.4; }
    }
    separateBalls(balls, damping);
    for (let i = balls.length - 1; i >= 0; i--) { if (balls[i].dead) balls.splice(i, 1); }
  }

  function separateBalls(list, damping) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j]; if (a.dead || b.dead) continue;
        const r = a.radius + b.radius; const dx = b.x - a.x; const dy = b.y - a.y; const dist = Math.hypot(dx, dy);
        if (dist > 1e-3 && dist < r) { const overlap = r - dist; const nx = dx / dist, ny = dy / dist; a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5; b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5; a.vx *= damping; a.vy *= damping; b.vx *= damping; b.vy *= damping; }
      }
    }
  }

  function ballInBucket(b) {
    const left = bucket.x - bucket.w / 2; const right = bucket.x + bucket.w / 2; const bottom = bucket.y - bucket.h / 2; const top = bucket.y + bucket.h / 2;
    return (b.x >= left + b.radius && b.x <= right - b.radius && b.y - b.radius >= bottom && b.y + b.radius <= top);
  }

  function ballThroughHoop(b) {
    // Simple scoring when ball center passes through hoop vertical band and within radius horizontally
    const verticalBand = Math.abs(b.y - hoop.y) <= b.radius * 0.8;
    const horizontalOk = Math.abs(b.x - hoop.x) <= hoop.r - b.radius * 0.5;
    return verticalBand && horizontalOk && b.vy < 0; // moving upward through hoop area
  }

  function resolveBallArmCollision(b, points) {
    const linkRadius = 8;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], c = points[i + 1];
      const cp = closestPointOnSegment(b.x, b.y, a.x, a.y, c.x, c.y);
      const dx = b.x - cp.x; const dy = b.y - cp.y; const dist = Math.hypot(dx, dy); const minDist = b.radius + linkRadius;
      if (dist < minDist) { const nx = dist > 1e-4 ? dx / dist : 0; const ny = dist > 1e-4 ? dy / dist : 1; const push = (minDist - dist) + 0.5; b.x += nx * push; b.y += ny * push; b.stuckUntil = nowSec() + 5; b.vx *= 0.5; b.vy = Math.max(0, b.vy) * 0.2; }
    }
    const end = points[points.length - 1]; const dx = b.x - end.x; const dy = b.y - end.y; const dist = Math.hypot(dx, dy); const minDist = b.radius + 10; if (dist < minDist) { const nx = dist > 1e-4 ? dx / dist : 0; const ny = dist > 1e-4 ? dy / dist : 1; const push = (minDist - dist) + 0.5; b.x += nx * push; b.y += ny * push; b.stuckUntil = nowSec() + 5; b.vx *= 0.5; b.vy = Math.max(0, b.vy) * 0.2; }
  }

  function closestPointOnSegment(px, py, ax, ay, bx, by) { const abx = bx - ax; const aby = by - ay; const apx = px - ax; const apy = py - ay; const ab2 = abx * abx + aby * aby; const t = ab2 === 0 ? 0 : clamp((apx * abx + apy * aby) / ab2, 0, 1); return { x: ax + t * abx, y: ay + t * aby }; }

  function spawnBallsBucket(dt) {
    const rate = difficultyEl ? Number(difficultyEl.value) : 2; spawnAccumulator += rate * dt;
    while (spawnAccumulator >= 1) { spawnAccumulator -= 1; const minX = baseX - totalReach * 0.9; const maxX = baseX + totalReach * 0.9; const x = minX + Math.random() * (maxX - minX); const y = 260 + Math.random() * 120; const radius = 8 + Math.random() * 6; balls.push({ x, y, vx: (Math.random() - 0.5) * 40, vy: 0, radius, scored: false, stuckUntil: 0 }); }
  }

  function spawnHeldBallIfNeeded(points) {
    if (!heldBall) {
      const end = points[points.length - 1];
      heldBall = { x: end.x, y: end.y, vx: 0, vy: 0, radius: 9 };
    }
  }

  function releaseHeldBall() {
    if (!heldBall) return;
    // Give initial velocity based on the end-effector tangent direction (approx from last angles)
    const [t1, t2, t3] = getAnglesRad();
    const t123 = t1 + t2 + t3;
    const speed = 420; // tune throw speed
    heldBall.vx = Math.cos(t123) * speed;
    heldBall.vy = Math.sin(t123) * speed;
    balls.push(heldBall);
    heldBall = null;
  }

  function stepBase(dt) { let vx = 0; if (keysDown.has('a') || keysDown.has('A')) vx -= baseMoveSpeed; if (keysDown.has('d') || keysDown.has('D')) vx += baseMoveSpeed; baseX += vx * dt; const { rect } = getCanvasMetrics(); const margin = 20; const halfW = rect.width / 2; baseX = clamp(baseX, -halfW + margin, halfW - margin); }

  function animate(ts) {
    const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0); lastTs = ts;
    stepBase(dt);
    if (controlMode === 'mouse' && mouseTarget) { solveIKCCD(mouseTarget, 14, 0.4); }

    const points = forwardKinematics(getAnglesDeg());
    const mode = gameModeEl ? gameModeEl.value : 'bucket';

    if (mode === 'bucket') {
      spawnBallsBucket(dt);
      stepBallsBucket(dt, points);
    } else {
      // basketball
      spawnHeldBallIfNeeded(points);
      stepBallsBasketball(dt, points);
    }

    clear(); drawArm(points); drawBalls(); updateCoordsDisplay(points); updateHUD();
    requestAnimationFrame(animate);
  }

  // Events
  ['input', 'change'].forEach((evt) => {
    theta1El.addEventListener(evt, () => { if (controlMode === 'sliders') updateOnce(); });
    theta2El.addEventListener(evt, () => { if (controlMode === 'sliders') updateOnce(); });
    theta3El.addEventListener(evt, () => { if (controlMode === 'sliders') updateOnce(); });
  });
  if (difficultyEl) { ['input', 'change'].forEach((evt) => { difficultyEl.addEventListener(evt, () => { updateOutputs(); }); }); }
  if (gameModeEl) { gameModeEl.addEventListener('change', () => { balls.length = 0; heldBall = null; score = 0; misses = 0; updateHUD(); }); }

  canvas.addEventListener('mousemove', (e) => { const { rect } = getCanvasMetrics(); const px = e.clientX - rect.left; const py = e.clientY - rect.top; const math = canvasToMath({ x: px, y: py }); mouseTarget = clampTargetToWorkspace(math); });
  canvas.addEventListener('mouseleave', () => { mouseTarget = null; });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); controlMode = controlMode === 'sliders' ? 'mouse' : 'sliders'; if (modeIndicatorEl) { modeIndicatorEl.textContent = controlMode === 'sliders' ? 'Mode: Sliders (press Tab to toggle Mouse Follow)' : 'Mode: Mouse Follow (press Tab to toggle Sliders)'; } return; }
    if (e.code === 'Space') { const mode = gameModeEl ? gameModeEl.value : 'bucket'; if (mode === 'basketball') { releaseHeldBall(); } }
    keysDown.add(e.key);
  });
  window.addEventListener('keyup', (e) => { keysDown.delete(e.key); });

  function handleResize() { setCanvasPixelRatio(); updateOnce(); }
  window.addEventListener('resize', handleResize);

  // Helpers
  function closestPointOnSegment(px, py, ax, ay, bx, by) { const abx = bx - ax; const aby = by - ay; const apx = px - ax; const apy = py - ay; const ab2 = abx * abx + aby * aby; const t = ab2 === 0 ? 0 : clamp((apx * abx + apy * aby) / ab2, 0, 1); return { x: ax + t * abx, y: ay + t * aby }; }

  // Init
  setCanvasPixelRatio(); updateOnce(); requestAnimationFrame(animate);
})();


