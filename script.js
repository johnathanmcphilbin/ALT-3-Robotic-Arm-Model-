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

  // Link lengths in pixels (tweak as desired)
  const linkLengths = [120, 100, 80];

  function degToRad(deg) { return (deg * Math.PI) / 180; }

  function getAngles() {
    const t1 = Number(theta1El.value);
    const t2 = Number(theta2El.value);
    const t3 = Number(theta3El.value);
    return [t1, t2, t3];
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
    clear();
    // Center origin in canvas
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height * 0.75; // a bit lower to give headroom

    // Draw grid
    drawGrid(cx, cy, rect.width, rect.height);

    // Convert math coords to canvas coords (y down)
    const toCanvas = (p) => ({ x: cx + p.x, y: cy - p.y });
    const cPoints = points.map(toCanvas);

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
  }

  function drawGrid(cx, cy, width, height) {
    const ctx2 = ctx;
    ctx2.save();
    ctx2.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx2.lineWidth = 1;
    const spacing = 40;
    // Vertical lines
    for (let x = 0; x <= width; x += spacing) {
      ctx2.beginPath();
      ctx2.moveTo(x, 0);
      ctx2.lineTo(x, height);
      ctx2.stroke();
    }
    // Horizontal lines
    for (let y = 0; y <= height; y += spacing) {
      ctx2.beginPath();
      ctx2.moveTo(0, y);
      ctx2.lineTo(width, y);
      ctx2.stroke();
    }

    // Axes through origin
    ctx2.strokeStyle = 'rgba(99, 102, 241, 0.5)';
    ctx2.beginPath();
    ctx2.moveTo(0, cy);
    ctx2.lineTo(width, cy);
    ctx2.moveTo(cx, 0);
    ctx2.lineTo(cx, height);
    ctx2.stroke();
    ctx2.restore();
  }

  function updateOutputs() {
    t1Out.textContent = `${theta1El.value}°`;
    t2Out.textContent = `${theta2El.value}°`;
    t3Out.textContent = `${theta3El.value}°`;
  }

  function update() {
    updateOutputs();
    const points = forwardKinematics(getAngles());
    drawArm(points);
    const end = points[points.length - 1];
    coordsEl.textContent = `End Effector: (x: ${end.x.toFixed(1)}, y: ${end.y.toFixed(1)})`;
  }

  // Bind events
  ['input', 'change'].forEach((evt) => {
    theta1El.addEventListener(evt, update);
    theta2El.addEventListener(evt, update);
    theta3El.addEventListener(evt, update);
  });

  // Handle resize for crisp pixels
  function handleResize() {
    setCanvasPixelRatio();
    update();
  }
  window.addEventListener('resize', handleResize);

  // Initial
  handleResize();
})();


