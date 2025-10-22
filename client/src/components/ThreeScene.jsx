import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ThreeScene({ events }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050312);

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 10000);
    camera.position.set(0, 120, 260);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x666666);
    scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 0.6);
    directional.position.set(120, 220, 180);
    scene.add(directional);

    const asteroids = new THREE.Group();
    scene.add(asteroids);

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    sceneRef.current = { scene, asteroids, processed: new Set() };
    rendererRef.current = renderer;
    cameraRef.current = camera;

    const handleResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    const { asteroids, processed } = sceneRef.current;
    const recentAsteroids = events.filter((evt) => evt.type === 'asteroid').slice(-24);

    recentAsteroids.forEach((evt) => {
      const physics = evt.payload?.physics;
      if (!physics) return;
      const messageId = evt.payload?.messageId ?? 'unknown';
      const replayFlag = evt.payload?.metadata?.replay ? 'r' : 'l';
      const key = `${messageId}:${physics.chunkIndex}:${replayFlag}`;
      if (processed.has(key)) return;
      processed.add(key);
      const asteroid = buildAsteroid(physics, evt.payload.metadata?.sentiment);
      asteroids.add(asteroid);
      animateAsteroid(asteroid, physics, () => {
        setTimeout(() => {
          asteroids.remove(asteroid);
          asteroid.geometry.dispose();
          asteroid.material.dispose();
          processed.delete(key);
        }, 8000);
      });
    });
  }, [events]);

  return <div className="three-container" ref={mountRef} />;
}

function buildAsteroid(physics, sentimentMeta) {
  const geometry = new THREE.IcosahedronGeometry(Math.cbrt(physics.mass) / 45, 1);
  const colorHex = resolveColor(physics, sentimentMeta);
  const material = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6, metalness: 0.1 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(-physics.velocity.direction.x * 10, -physics.velocity.direction.y * 10, -physics.velocity.direction.z * 10);
  return mesh;
}

function animateAsteroid(mesh, physics, onImpact) {
  const velocity = physics.velocity;
  let progress = 0;
  const target = new THREE.Vector3(
    velocity.direction.x * velocity.magnitude * 0.02,
    velocity.direction.y * velocity.magnitude * 0.02,
    velocity.direction.z * velocity.magnitude * 0.02
  );

  function frame() {
    progress = Math.min(progress + 0.012, 1);
    mesh.position.lerp(target, progress);
    mesh.rotation.x += physics.spin.rpm * 0.01;
    mesh.rotation.y += physics.spin.rpm * 0.008;
    mesh.rotation.z += physics.spin.rpm * 0.004;
    if (progress < 1) {
      requestAnimationFrame(frame);
    } else if (onImpact) {
      onImpact();
      onImpact = null;
    }
  }
  requestAnimationFrame(frame);
}

function resolveColor(physics, sentimentMeta) {
  if (physics?.visual?.color) {
    return new THREE.Color(physics.visual.color);
  }
  if (sentimentMeta?.color) {
    return new THREE.Color(sentimentMeta.color);
  }
  return new THREE.Color(compositionColor(physics.compositionCode));
}

function compositionColor(code) {
  switch (code) {
    case 0:
      return 0xffd166;
    case 1:
      return 0x06d6a0;
    case 2:
      return 0x118ab2;
    case 3:
      return 0xef476f;
    default:
      return 0x8338ec;
  }
}
