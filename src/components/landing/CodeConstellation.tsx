'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Line } from '@react-three/drei';
import { Vector3, MathUtils } from 'three';
import type { Mesh, MeshStandardMaterial, Group } from 'three';

interface CodeConstellationProps {
  mouse: { x: number; y: number };
}

// Color palette for node groups
const NODE_COLORS = [
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#8b5cf6', // purple
  '#22c55e', // green
];

const CONNECTION_COLOR = '#60a5fa';
const NODE_COUNT = 40;
const HUB_INDICES = [0, 8, 16, 24, 35]; // 5 hub nodes spread across the sphere

interface NodeData {
  position: Vector3;
  color: string;
  baseSize: number;
  isHub: boolean;
  pulseOffset: number; // random offset so nodes pulse at different times
  pulseSpeed: number;
}

interface ConnectionData {
  start: Vector3;
  end: Vector3;
}

/**
 * Distribute points on a fibonacci sphere for organic, even spacing.
 */
function fibonacciSphere(count: number, radius: number): Vector3[] {
  const points: Vector3[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~2.3999 radians

  for (let i = 0; i < count; i++) {
    // Y goes from 1 to -1
    const y = 1 - (i / (count - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;

    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;

    points.push(new Vector3(x * radius, y * radius, z * radius));
  }

  return points;
}

/**
 * For each node, find its nearest neighbors and build connection pairs.
 * Each node connects to between minConnections and maxConnections neighbors
 * within maxDistance.
 */
function findConnections(
  nodes: Vector3[],
  minConnections: number,
  maxConnections: number,
  maxDistance: number
): ConnectionData[] {
  const connections: ConnectionData[] = [];
  const connectionSet = new Set<string>();

  for (let i = 0; i < nodes.length; i++) {
    // Calculate distances to all other nodes
    const distances: { index: number; dist: number }[] = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const dist = nodes[i].distanceTo(nodes[j]);
      if (dist < maxDistance) {
        distances.push({ index: j, dist });
      }
    }

    // Sort by distance and take the closest few
    distances.sort((a, b) => a.dist - b.dist);
    const numConnections = Math.min(
      minConnections + Math.floor(Math.random() * (maxConnections - minConnections + 1)),
      distances.length
    );

    for (let k = 0; k < numConnections; k++) {
      const j = distances[k].index;
      // Avoid duplicate connections (i-j and j-i)
      const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
      if (!connectionSet.has(key)) {
        connectionSet.add(key);
        connections.push({
          start: nodes[i],
          end: nodes[j],
        });
      }
    }
  }

  return connections;
}

/**
 * A single node sphere that can pulse independently via useFrame.
 */
function ConstellationNode({ node }: { node: NodeData }) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshStandardMaterial>(null);

  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return;

    const time = state.clock.elapsedTime;
    // Pulse calculation: sin wave offset per node
    const pulsePhase = Math.sin(time * node.pulseSpeed + node.pulseOffset);
    // Remap from [-1, 1] to [0, 1] then to scale range [1, 1.5]
    const pulseNormalized = (pulsePhase + 1) * 0.5;
    const scale = 1 + pulseNormalized * 0.5;
    const emissive = 0.6 + pulseNormalized * 0.8;

    meshRef.current.scale.setScalar(scale);
    materialRef.current.emissiveIntensity = emissive;
  });

  return (
    <mesh ref={meshRef} position={node.position}>
      <sphereGeometry args={[node.baseSize, 16, 16]} />
      <meshStandardMaterial
        ref={materialRef}
        color={node.color}
        emissive={node.color}
        emissiveIntensity={0.6}
      />
    </mesh>
  );
}

export default function CodeConstellation({ mouse }: CodeConstellationProps) {
  const groupRef = useRef<Group>(null);

  // Generate node data (positions, colors, sizes) — memoized since it's static
  const nodes: NodeData[] = useMemo(() => {
    const positions = fibonacciSphere(NODE_COUNT, 1.6);
    return positions.map((position, i) => {
      const isHub = HUB_INDICES.includes(i);
      const colorIndex = i % NODE_COLORS.length;
      // Vary sizes: hubs are larger, others vary between 0.04 and 0.08
      const baseSize = isHub ? 0.12 : 0.04 + Math.random() * 0.04;
      return {
        position,
        color: NODE_COLORS[colorIndex],
        baseSize,
        isHub,
        pulseOffset: Math.random() * Math.PI * 2,
        pulseSpeed: 0.5 + Math.random() * 1.5, // different pulse frequencies
      };
    });
  }, []);

  // Generate connections — memoized since node positions are static
  const connections: ConnectionData[] = useMemo(() => {
    const positions = nodes.map((n) => n.position);
    return findConnections(positions, 2, 4, 1.2);
  }, [nodes]);

  // Animation: rotation + mouse parallax
  useFrame((_state, delta) => {
    if (!groupRef.current) return;

    // Slow Y-axis rotation
    groupRef.current.rotation.y += delta * 0.08;

    // Mouse parallax tilt (same approach as KnowledgeCube)
    const maxTilt = MathUtils.degToRad(12);
    const targetRotationX = -mouse.y * maxTilt;
    const targetRotationZ = mouse.x * maxTilt;

    groupRef.current.rotation.x = MathUtils.lerp(
      groupRef.current.rotation.x,
      targetRotationX,
      0.05
    );
    groupRef.current.rotation.z = MathUtils.lerp(
      groupRef.current.rotation.z,
      targetRotationZ,
      0.05
    );
  });

  return (
    <Float speed={1} rotationIntensity={0.1} floatIntensity={0.3}>
      <group ref={groupRef}>
        {/* Connections */}
        {connections.map((conn, i) => (
          <Line
            key={`conn-${i}`}
            points={[conn.start, conn.end]}
            lineWidth={0.8}
            color={CONNECTION_COLOR}
            transparent
            opacity={0.25}
          />
        ))}

        {/* Nodes */}
        {nodes.map((node, i) => (
          <ConstellationNode key={`node-${i}`} node={node} />
        ))}
      </group>
    </Float>
  );
}
