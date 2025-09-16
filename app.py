from math import cos, sin, radians
from flask import Flask, render_template, request, jsonify


app = Flask(__name__)


# Link lengths (arbitrary units suitable for 3D scene scale)
LINK_LENGTHS = (1.2, 1.0, 0.8)


def forward_kinematics_3d(theta1_deg: float, theta2_deg: float, theta3_deg: float):
  """Compute end-effector (x, y, z) for a 3-link arm with:
  θ1: base yaw about Z
  θ2: shoulder pitch about X
  θ3: elbow pitch about X

  Links are aligned along +Y in their local frames. Pitching about +X moves links in Y-Z plane.
  """
  t1 = radians(theta1_deg)
  t2 = radians(theta2_deg)
  t3 = radians(theta3_deg)
  L1, L2, L3 = LINK_LENGTHS

  # Effective Y and Z components before yaw, given local +Y alignment and X-axis pitch.
  sumY = (L1 * cos(t2)) + (L2 * cos(t2 + t3)) + (L3 * cos(t2 + t3))
  sumZ = (L1 * sin(t2)) + (L2 * sin(t2 + t3)) + (L3 * sin(t2 + t3))

  # Apply yaw about Z to rotate Y component into X/Y plane.
  x = -sin(t1) * sumY
  y =  cos(t1) * sumY
  z =  sumZ

  return x, y, z


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


