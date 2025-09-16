# ALT-3-Robotic-Arm-Model-

Robotic Arm Kinematics Simulator

How to run
----------

- Open `index.html` directly in your browser (no build needed).

Features
--------

- Three sliders for angles θ1, θ2, θ3 (0–180°)
- Real-time 2D drawing of a 3-link arm on a canvas
- End-effector `(x, y)` coordinates updated live
- Responsive, minimal, centered layout using HTML + CSS + vanilla JS

Notes
-----

- Link lengths are set in `script.js` via `linkLengths = [120, 100, 80]` (px). Adjust as needed.
- Angles are interpreted as planar rotations, cumulative from the base.