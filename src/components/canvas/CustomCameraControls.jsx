import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * CustomCameraControls
 *
 * Mobile touch:
 *   1 finger  → orbit (yaw/pitch, no roll)
 *   2 fingers → decomposed into 3 independent gestures:
 *     - Pinch distance change  → zoom
 *     - Midpoint movement      → orbit (yaw/pitch)
 *     - Angle change of finger line → roll/twist (around camera forward axis)
 *
 * Desktop mouse:
 *   Left-click drag → trackball rotation
 *   Scroll wheel    → zoom
 */
export default function CustomCameraControls({
  target = [0, 2, 0],
  minDistance = 3,
  maxDistance = 15,
  orbitSpeed = 0.006,
  pinchOrbitSpeed = 0.008,
  rollSensitivity = 1.0,
  isAutoRotate = false,
  autoRotateSpeed = 2.0,
}) {
  const { camera, gl } = useThree();
  const targetV = useRef(new THREE.Vector3(...target));

  const state = useRef({
    dir: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
    distance: 10,
  });

  // Initialise from camera's real starting position
  useEffect(() => {
    const s = state.current;
    s.dir.copy(camera.position).sub(targetV.current);
    s.distance = s.dir.length();
    s.dir.normalize();
    s.up.copy(camera.up).normalize();
  }, []); // eslint-disable-line

  useEffect(() => {
    const canvas = gl.domElement;
    const s = state.current;
    const clamp = (d) => Math.max(minDistance, Math.min(maxDistance, d));

    // ─── Trackball projection (used by desktop mouse) ────────────────────────
    const project = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
      const r2 = nx * nx + ny * ny;
      const v = r2 <= 0.5
        ? new THREE.Vector3(nx, ny, Math.sqrt(1 - r2))
        : new THREE.Vector3(nx, ny, 0.5 / Math.sqrt(r2));
      return v.normalize();
    };

    const applyTrackball = (x1, y1, x2, y2) => {
      const p1 = project(x1, y1);
      const p2 = project(x2, y2);
      const axis = p1.clone().cross(p2);
      const len = axis.length();
      if (len < 1e-7) return;
      axis.divideScalar(len);
      const angle = Math.acos(Math.max(-1, Math.min(1, p1.dot(p2)))) * 2.5;
      const worldAxis = axis.clone().applyQuaternion(camera.quaternion);
      const q = new THREE.Quaternion().setFromAxisAngle(worldAxis, -angle);
      s.dir.applyQuaternion(q).normalize();
      s.up.applyQuaternion(q).normalize();
    };

    // ─── Orbit (no roll) ─────────────────────────────────────────────────────
    const applyOrbit = (dx, dy, speedFactor) => {
      // Normalize by canvas dimensions to ensure consistent feel across phones, tablets, and desktop
      const normDx = dx / canvas.clientWidth;
      const normDy = dy / canvas.clientHeight;
      
      const spd = speedFactor ?? (Math.PI * 1.5); // Default: 1.5 PI radians per full screen swipe
      // Orbit axes relative to camera's current orientation ensures stable controls even when rolled
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      
      const yaw = new THREE.Quaternion().setFromAxisAngle(up, -normDx * spd);
      const pitch = new THREE.Quaternion().setFromAxisAngle(right, -normDy * spd);
      
      s.dir.applyQuaternion(pitch).applyQuaternion(yaw).normalize();
      s.up.applyQuaternion(pitch).applyQuaternion(yaw).normalize();
    };

    // ─── Touch state ─────────────────────────────────────────────────────────
    let prevTouches = [];
    let prevPinchDist = 0;
    let prevAngle = 0;       // angle of finger-line for twist detection
    const toArr = (e) => Array.from(e.touches);

    const fingerAngle = (t0, t1) =>
      Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);

    const fingerDist = (t0, t1) =>
      Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);

    const onTouchStart = (e) => {
      e.preventDefault();
      prevTouches = toArr(e);
      if (prevTouches.length === 2) {
        prevPinchDist = fingerDist(prevTouches[0], prevTouches[1]);
        prevAngle = fingerAngle(prevTouches[0], prevTouches[1]);
      }
    };

    const onTouchMove = (e) => {
      e.preventDefault();
      const curr = toArr(e);

      if (curr.length === 1 && prevTouches.length === 1) {
        // ── 1 finger: orbit ──────────────────────────────────────────────────
        applyOrbit(
          curr[0].clientX - prevTouches[0].clientX,
          curr[0].clientY - prevTouches[0].clientY,
        );

      } else if (curr.length === 2 && prevTouches.length >= 2) {
        // ── 2 fingers: 3-gesture decomposition ───────────────────────────────

        const pinch = fingerDist(curr[0], curr[1]);
        const angle = fingerAngle(curr[0], curr[1]);

        // 1) Pinch → zoom
        if (prevPinchDist > 0) {
          s.distance = clamp(s.distance * (prevPinchDist / pinch));
        }

        // 2) Twist (finger-line angle delta) → roll around camera forward
        let dAngle = angle - prevAngle;
        // Normalise to [-π, π] to avoid wrap-around jumps
        if (dAngle >  Math.PI) dAngle -= 2 * Math.PI;
        if (dAngle < -Math.PI) dAngle += 2 * Math.PI;

        if (Math.abs(dAngle) > 0.001) {
          // Roll twists the camera around its viewing axis (s.dir)
          // Rotate s.up around s.dir (inverted the sign to match natural rotation)
          const rollQ = new THREE.Quaternion().setFromAxisAngle(s.dir, dAngle * rollSensitivity);
          s.up.applyQuaternion(rollQ).normalize();
        }

        // 3) Midpoint movement → orbit
        if (prevTouches.length >= 2) {
          const prevMx = (prevTouches[0].clientX + prevTouches[1].clientX) / 2;
          const prevMy = (prevTouches[0].clientY + prevTouches[1].clientY) / 2;
          const currMx = (curr[0].clientX + curr[1].clientX) / 2;
          const currMy = (curr[0].clientY + curr[1].clientY) / 2;
          applyOrbit(currMx - prevMx, currMy - prevMy, Math.PI * 2.0); // Slightly faster orbit when pinching
        }

        prevPinchDist = pinch;
        prevAngle = angle;
      }

      prevTouches = curr;
    };

    const onTouchEnd = (e) => {
      prevTouches = toArr(e);
      prevPinchDist = 0;
    };

    // ─── Mouse (desktop) ─────────────────────────────────────────────────────
    let mouseDown = false;
    let prevMouse = { x: 0, y: 0 };

    const onMouseDown = (e) => {
      mouseDown = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e) => {
      if (!mouseDown) return;
      applyTrackball(prevMouse.x, prevMouse.y, e.clientX, e.clientY);
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { mouseDown = false; };
    const onWheel = (e) => {
      s.distance = clamp(s.distance * (e.deltaY > 0 ? 1.1 : 0.9));
    };

    // ─── Reset camera ────────────────────────────────────────────────────────
    const onReset = () => {
      const initial = new THREE.Vector3(8, 6, 9).sub(targetV.current);
      s.distance = initial.length();
      s.dir.copy(initial).normalize();
      s.up.set(0, 1, 0);
    };

    // ─── Register ────────────────────────────────────────────────────────────
    canvas.addEventListener('touchstart',  onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',   onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',    onTouchEnd,   { passive: false });
    canvas.addEventListener('mousedown',   onMouseDown);
    window.addEventListener('mousemove',   onMouseMove);
    window.addEventListener('mouseup',     onMouseUp);
    canvas.addEventListener('wheel',       onWheel,      { passive: true });
    window.addEventListener('resetCamera', onReset);

    return () => {
      canvas.removeEventListener('touchstart',  onTouchStart);
      canvas.removeEventListener('touchmove',   onTouchMove);
      canvas.removeEventListener('touchend',    onTouchEnd);
      canvas.removeEventListener('mousedown',   onMouseDown);
      window.removeEventListener('mousemove',   onMouseMove);
      window.removeEventListener('mouseup',     onMouseUp);
      canvas.removeEventListener('wheel',       onWheel);
      window.removeEventListener('resetCamera', onReset);
    };
  }, [gl, minDistance, maxDistance, orbitSpeed, pinchOrbitSpeed, rollSensitivity]); // eslint-disable-line

  useFrame((stateObj, delta) => {
    const s = state.current;
    
    if (isAutoRotate) {
      const angle = delta * autoRotateSpeed * 0.1;
      const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      s.dir.applyQuaternion(yaw).normalize();
      s.up.applyQuaternion(yaw).normalize();
    }

    if (s.dir.length() < 0.5) s.dir.set(0, 0, 1);
    s.dir.normalize();
    s.up.normalize();
    camera.position
      .copy(targetV.current)
      .addScaledVector(s.dir, s.distance);
    camera.up.copy(s.up);
    camera.lookAt(targetV.current);
  });

  return null;
}
