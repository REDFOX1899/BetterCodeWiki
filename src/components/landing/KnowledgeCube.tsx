'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Edges, MeshTransmissionMaterial } from '@react-three/drei';
import { MathUtils } from 'three';
import type { Mesh } from 'three';

interface KnowledgeCubeProps {
  mouse: { x: number; y: number };
}

export default function KnowledgeCube({ mouse }: KnowledgeCubeProps) {
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;

    // Continuous Y rotation
    meshRef.current.rotation.y += 0.003;

    // Mouse parallax with lerp
    const maxTilt = MathUtils.degToRad(15);
    const targetRotationX = -mouse.y * maxTilt;
    const targetRotationZ = mouse.x * maxTilt;

    meshRef.current.rotation.x = MathUtils.lerp(
      meshRef.current.rotation.x,
      targetRotationX,
      0.05
    );
    meshRef.current.rotation.z = MathUtils.lerp(
      meshRef.current.rotation.z,
      targetRotationZ,
      0.05
    );
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.8, 1]} />
        <MeshTransmissionMaterial
          thickness={0.5}
          roughness={0.3}
          chromaticAberration={0.15}
          color="#4a90d9"
          transmission={0.9}
          ior={1.5}
          backside
        />
        <Edges color="#3b82f6" linewidth={1.5} />
      </mesh>
    </Float>
  );
}
