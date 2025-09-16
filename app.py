from math import cos, sin, radians
from flask import Flask, render_template, request, jsonify


app = Flask(__name__)


# Link lengths (arbitrary units suitable for 3D scene scale)
LINK_LENGTHS = (1.2, 1.0, 0.8)


def forward_kinematics_3d(theta1_deg: float, theta2_deg: float, theta3_deg: float):
  """Compute end-effector position (x, y, z) for a planar 3-link arm in 3D (z=0).

  All rotations are about the Z axis, cumulative from the base.
  """
  t1 = radians(theta1_deg)
  t2 = radians(theta2_deg)
  t3 = radians(theta3_deg)
  L1, L2, L3 = LINK_LENGTHS

  x1 = L1 * cos(t1)
  y1 = L1 * sin(t1)

  t12 = t1 + t2
  x2 = x1 + L2 * cos(t12)
  y2 = y1 + L2 * sin(t12)

  t123 = t12 + t3
  x3 = x2 + L3 * cos(t123)
  y3 = y2 + L3 * sin(t123)

  return x3, y3, 0.0


@app.route('/')
def index():
  return render_template('index.html')


@app.route('/calculate', methods=['POST'])
def calculate():
  try:
    data = request.get_json(force=True, silent=False) or {}
    theta1 = float(data.get('theta1', 0))
    theta2 = float(data.get('theta2', 0))
    theta3 = float(data.get('theta3', 0))
  except Exception:
    return jsonify({ 'error': 'Invalid JSON payload. Expected numbers for theta1, theta2, theta3.' }), 400

  x, y, z = forward_kinematics_3d(theta1, theta2, theta3)
  return jsonify({ 'x': x, 'y': y, 'z': z })


if __name__ == '__main__':
  app.run(host='0.0.0.0', port=5000, debug=True)


