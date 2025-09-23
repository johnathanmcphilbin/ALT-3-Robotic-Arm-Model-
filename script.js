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

  // Link lengths in pixels (tweak as desired)
  const linkLengths = [120, 100, 80];

  // Control mode: 'sliders' or 'mouse'
  let controlMode = 'sliders';

  // Mouse target in math space (y up), null when not active
  let mouseTarget = null;

  // Falling blocks state
  const blocks = [];
  let spawnAccumulator = 0; // seconds

  function degToRad(deg) { return (deg * Math.PI) / 180; }
  function radToDeg(rad) { return (rad * 180) / Math.PI; }

  function getAnglesDeg() {
    const t1 = Number(theta1El.value);
    const t2 = Number(theta2El.value);
    const t3 = Number(theta3El.value);
    return [t1, t2, t3];
  }

  function setAnglesDeg([a, b, c]) {
    theta1El.value = String(a);
    theta2El.value = String(b);
    theta3El.value = String(c);
    updateOutputs();
  }

  function getAnglesRad() {
    return getAnglesDeg().map(degToRad);
  }

  function setAnglesRad([a, b, c]) {
    setAnglesDeg([radToDeg(a), radToDeg(b), radToDeg(c)].map((v) => Math.max(0, Math.min(180, v))));
  }

  function forwardKinematics(anglesDeg) {
    const [t1, t2, t3] = anglesDeg.map(degToRad);
    const [L1, L2, L3] = linkLengths;

    // Joint positions in math coordinates (y up)
    const x1 = L1 * Math.cos(t1);
    const y1 = L1 * Math.sin(t1);

    const t12 = t1 + t2;
    const x2 = x1 + L2 * Math.cos(t12);
    const y2 = y1 + L2 * Math.sin(t12);

    const t123 = t12 + t3;
    const x3 = x2 + L3 * Math.cos(t123);
    const y3 = y2 + L3 * Math.sin(t123);

    return [
      { x: 0, y: 0 }, // base
      { x: x1, y: y1 },
      { x: x2, y: y2 },
      { x: x3, y: y3 }, // end effector
    ];
  }

  function getCanvasMetrics() {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height * 0.75; // a bit lower to give headroom
    return { rect, cx, cy };
  }

  function mathToCanvas(p) {
    const { rect, cx, cy } = getCanvasMetrics();
    return { x: cx + p.x, y: cy - p.y };
  }

  function canvasToMath(p) {
    const { rect, cx, cy } = getCanvasMetrics();
    return { x: p.x - cx, y: cy - p.y };
  }

  function setCanvasPixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawArm(points) {
    // Center origin in canvas
    const { rect } = getCanvasMetrics();

    // Draw grid
    drawGrid();

    // Convert math coords to canvas coords (y down)
    const cPoints = points.map(mathToCanvas);

    // Draw links
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.95)';
    ctx.beginPath();
    ctx.moveTo(cPoints[0].x, cPoints[0].y);
    for (let i = 1; i < cPoints.length; i++) {
      ctx.lineTo(cPoints[i].x, cPoints[i].y);
    }
    ctx.stroke();

    // Draw joints
    for (let i = 0; i < cPoints.length; i++) {
      ctx.fillStyle = i === cPoints.length - 1 ? '#fbbf24' : '#e5e7eb';
      ctx.beginPath();
      ctx.arc(cPoints[i].x, cPoints[i].y, i === 0 ? 6 : 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw mouse target if active
    if (mouseTarget && controlMode === 'mouse') {
      const m = mathToCanvas(mouseTarget);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(m.x - 10, m.y);
      ctx.lineTo(m.x + 10, m.y);
      ctx.moveTo(m.x, m.y - 10);
      ctx.lineTo(m.x, m.y + 10);
      ctx.stroke();
    }
  }

  function drawGrid() {
    const { rect, cx, cy } = getCanvasMetrics();
    const ctx2 = ctx;
    ctx2.save();
    ctx2.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx2.lineWidth = 1;
    const spacing = 40;
    // Vertical lines
    for (let x = 0; x <= rect.width; x += spacing) {
      ctx2.beginPath();
      ctx2.moveTo(x, 0);
      ctx2.lineTo(x, rect.height);
      ctx2.stroke();
    }
    // Horizontal lines
    for (let y = 0; y <= rect.height; y += spacing) {
      ctx2.beginPath();
      ctx2.moveTo(0, y);
      ctx2.lineTo(rect.width, y);
      ctx2.stroke();
    }

    // Axes through origin
    ctx2.strokeStyle = 'rgba(99, 102, 241, 0.5)';
    ctx2.beginPath();
    ctx2.moveTo(0, cy);
    ctx2.lineTo(rect.width, cy);
    ctx2.moveTo(cx, 0);
    ctx2.lineTo(cx, rect.height);
    ctx2.stroke();
    ctx2.restore();
  }

  function updateOutputs() {
    t1Out.textContent = `${theta1El.value}°`;
    t2Out.textContent = `${theta2El.value}°`;
    t3Out.textContent = `${theta3El.value}°`;
  }

  function updateCoordsDisplay(points) {
    const end = points[points.length - 1];
    coordsEl.textContent = `End Effector: (x: ${end.x.toFixed(1)}, y: ${end.y.toFixed(1)})`;
  }

  // CCD IK for planar 3-link
  function solveIKCCD(target, iterations = 12, tolerance = 0.5) {
    const [L1, L2, L3] = linkLengths;

    // Current angles as absolute joint angles in world space
    const rel = getAnglesRad();
    let abs1 = rel[0];
    let abs2 = rel[0] + rel[1];
    let abs3 = rel[0] + rel[1] + rel[2];

    function jointsFromAbs(a1, a2, a3) {
      const p0 = { x: 0, y: 0 };
      const p1 = { x: L1 * Math.cos(a1), y: L1 * Math.sin(a1) };
      const p2 = { x: p1.x + L2 * Math.cos(a2), y: p1.y + L2 * Math.sin(a2) };
      const p3 = { x: p2.x + L3 * Math.cos(a3), y: p2.y + L3 * Math.sin(a3) };
      return [p0, p1, p2, p3];
    }

    function angleBetween(v1, v2) {
      const dot = v1.x * v2.x + v1.y * v2.y;
      const det = v1.x * v2.y - v1.y * v2.x; // 2D cross z-component
      return Math.atan2(det, dot);
    }

    for (let iter = 0; iter < iterations; iter++) {
      let [p0, p1, p2, p3] = jointsFromAbs(abs1, abs2, abs3);

      // Early exit if close
      const dx = target.x - p3.x;
      const dy = target.y - p3.y;
      if (Math.hypot(dx, dy) < tolerance) break;

      // Adjust joint 3 (elbow)
      let v3 = { x: p3.x - p2.x, y: p3.y - p2.y };
      let vt = { x: target.x - p2.x, y: target.y - p2.y };
      abs3 += angleBetween(v3, vt);

      // Recompute
      [p0, p1, p2, p3] = jointsFromAbs(abs1, abs2, abs3);

      // Adjust joint 2 (shoulder)
      v3 = { x: p3.x - p1.x, y: p3.y - p1.y };
      vt = { x: target.x - p1.x, y: target.y - p1.y };
      abs2 += angleBetween(v3, vt);

      // Recompute
      [p0, p1, p2, p3] = jointsFromAbs(abs1, abs2, abs3);

      // Adjust joint 1 (base)
      v3 = { x: p3.x - p0.x, y: p3.y - p0.y };
      vt = { x: target.x - p0.x, y: target.y - p0.y };
      abs1 += angleBetween(v3, vt);

      // Clamp absolute angles so that relative angles remain within [0, pi]
      // Compute relatives
      let r1 = abs1;
      let r2 = abs2 - abs1;
      let r3 = abs3 - abs2;
      r1 = clamp(r1, 0, Math.PI);
      r2 = clamp(r2, 0, Math.PI);
      r3 = clamp(r3, 0, Math.PI);
      abs1 = r1;
      abs2 = r1 + r2;
      abs3 = r1 + r2 + r3;
    }

    // Convert back to relatives and set
    const r1 = abs1;
    const r2 = abs2 - abs1;
    const r3 = abs3 - abs2;
    setAnglesRad([r1, r2, r3]);
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function updateOnce() {
    updateOutputs();
    const points = forwardKinematics(getAnglesDeg());
    clear();
    drawArm(points);
    drawBlocks();
    updateCoordsDisplay(points);
  }

  function drawBlocks() {
    for (const b of blocks) {
      const c = mathToCanvas({ x: b.x, y: b.y });
      const s = b.size;
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(c.x - s / 2, c.y - s / 2, s, s);
    }
  }

  function stepBlocks(dt) {
    const gravity = -900; // px/s^2 in math coords (y up => negative)
    const floorY = 0; // base level
    for (const b of blocks) {
      b.vy += gravity * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // Simple floor collision -> remove
      if (b.y <= floorY) {
        b.dead = true;
      }
    }
    // Remove dead blocks
    for (let i = blocks.length - 1; i >= 0; i--) {
      if (blocks[i].dead) blocks.splice(i, 1);
    }
  }

  function spawnBlocks(dt) {
    spawnAccumulator += dt;
    const spawnInterval = 0.8; // seconds
    while (spawnAccumulator >= spawnInterval) {
      spawnAccumulator -= spawnInterval;
      const { rect, cx } = getCanvasMetrics();
      const x = (Math.random() * rect.width) - (rect.width / 2); // around origin
      const y = 260 + Math.random() * 120; // start high above base
      const size = 14 + Math.random() * 10;
      blocks.push({ x, y, vx: (Math.random() - 0.5) * 40, vy: 0, size });
    }
  }

  // Animation loop
  let lastTs = 0;
  function animate(ts) {
    const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0);
    lastTs = ts;

    if (controlMode === 'mouse' && mouseTarget) {
      solveIKCCD(mouseTarget, 10, 0.6);
    }

    spawnBlocks(dt);
    stepBlocks(dt);

    updateOnce();
    requestAnimationFrame(animate);
  }

  // Bind events
  ['input', 'change'].forEach((evt) => {
    theta1El.addEventListener(evt, () => {
      if (controlMode === 'sliders') updateOnce();
    });
    theta2El.addEventListener(evt, () => {
      if (controlMode === 'sliders') updateOnce();
    });
    theta3El.addEventListener(evt, () => {
      if (controlMode === 'sliders') updateOnce();
    });
  });

  // Mouse handling
  canvas.addEventListener('mousemove', (e) => {
    const { rect } = getCanvasMetrics();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const math = canvasToMath({ x: px, y: py });
    mouseTarget = math;
  });
  canvas.addEventListener('mouseleave', () => {
    mouseTarget = null;
  });

  // Toggle control mode with Tab
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      controlMode = controlMode === 'sliders' ? 'mouse' : 'sliders';
      if (modeIndicatorEl) {
        modeIndicatorEl.textContent = controlMode === 'sliders'
          ? 'Mode: Sliders (press Tab to toggle Mouse Follow)'
          : 'Mode: Mouse Follow (press Tab to toggle Sliders)';
      }
    }
  });

  // Handle resize for crisp pixels
  function handleResize() {
    setCanvasPixelRatio();
    updateOnce();
  }
  window.addEventListener('resize', handleResize);

  // Initial
  handleResize();
  requestAnimationFrame(animate);
})();


