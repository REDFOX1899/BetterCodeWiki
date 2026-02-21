'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

const PARTICLE_COUNT = 500;
const CURVE_COUNT = 5;

// Pre-allocate a reusable vector to avoid allocations in useFrame
const _tempVec = new THREE.Vector3();

function generateFlowCurves(count: number): THREE.CubicBezierCurve3[] {
  const curves: THREE.CubicBezierCurve3[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = 2.5 + Math.random() * 1.5;
    const yOffset = (Math.random() - 0.5) * 3;
    const spiralTwist = Math.PI * 0.6 + Math.random() * Math.PI * 0.8;

    // Start point on one side of the scene
    const startX = radius * Math.cos(angle);
    const startY = yOffset - 1.5 + Math.random() * 0.5;
    const startZ = radius * Math.sin(angle);

    // End point spirals around to a different position
    const endAngle = angle + spiralTwist;
    const endRadius = 2.5 + Math.random() * 1.5;
    const endX = endRadius * Math.cos(endAngle);
    const endY = yOffset + 1.5 + Math.random() * 0.5;
    const endZ = endRadius * Math.sin(endAngle);

    // Control points create the curved, spiraling path
    const midAngle1 = angle + spiralTwist * 0.33;
    const midAngle2 = angle + spiralTwist * 0.66;
    const cp1Radius = radius * (0.6 + Math.random() * 0.8);
    const cp2Radius = endRadius * (0.6 + Math.random() * 0.8);

    curves.push(
      new THREE.CubicBezierCurve3(
        new THREE.Vector3(startX, startY, startZ),
        new THREE.Vector3(
          cp1Radius * Math.cos(midAngle1),
          yOffset - 0.5 + Math.random() * 1.0,
          cp1Radius * Math.sin(midAngle1)
        ),
        new THREE.Vector3(
          cp2Radius * Math.cos(midAngle2),
          yOffset + 0.5 + Math.random() * 1.0,
          cp2Radius * Math.sin(midAngle2)
        ),
        new THREE.Vector3(endX, endY, endZ)
      )
    );
  }
  return curves;
}

interface ParticleData {
  curveIndices: Uint8Array;
  progress: Float32Array;
  speeds: Float32Array;
  curves: THREE.CubicBezierCurve3[];
}

export default function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null);

  // Memoize curves, curve assignments, progress values, and speeds
  const particleData = useMemo<ParticleData>(() => {
    const curves = generateFlowCurves(CURVE_COUNT);
    const curveIndices = new Uint8Array(PARTICLE_COUNT);
    const progress = new Float32Array(PARTICLE_COUNT);
    const speeds = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      curveIndices[i] = Math.floor(Math.random() * CURVE_COUNT);
      progress[i] = Math.random(); // start at random point along curve
      speeds[i] = 0.02 + Math.random() * 0.06; // range: 0.02 to 0.08
    }

    return { curveIndices, progress, speeds, curves };
  }, []);

  // Initial positions computed from curves
  const positions = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const { curves, curveIndices, progress } = particleData;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const curve = curves[curveIndices[i]];
      const point = curve.getPoint(progress[i]);
      pos[i * 3] = point.x;
      pos[i * 3 + 1] = point.y;
      pos[i * 3 + 2] = point.z;
    }

    return pos;
  }, [particleData]);

  useFrame((_state, delta) => {
    if (!pointsRef.current) return;

    const { curves, curveIndices, progress, speeds } = particleData;
    const geometry = pointsRef.current.geometry;
    const posAttr = geometry.attributes.position;
    const posArray = posAttr.array as Float32Array;

    // Advance each particle along its curve
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Update progress
      progress[i] += speeds[i] * delta;

      // Wrap back to start when reaching the end
      if (progress[i] > 1) {
        progress[i] -= 1;
      }

      // Sample position on curve using pre-allocated vector
      const curve = curves[curveIndices[i]];
      curve.getPoint(progress[i], _tempVec);

      posArray[i * 3] = _tempVec.x;
      posArray[i * 3 + 1] = _tempVec.y;
      posArray[i * 3 + 2] = _tempVec.z;
    }

    // Flag the buffer for GPU upload
    posAttr.needsUpdate = true;

    // Slow overall rotation on Y axis
    pointsRef.current.rotation.y += delta * 0.03;
  });

  return (
    <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        color="#b3d4fc"
        size={0.02}
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}
