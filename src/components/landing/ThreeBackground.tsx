import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * A drifting field of glowing blue particles behind the hero, with a
 * couple of large soft-lit icosahedra slowly tumbling through it. Reacts
 * gently to pointer movement on devices that have a real pointer (skipped
 * on touch — nothing to react to there). Particle/shape counts scale down
 * under ~640px so phones stay smooth.
 */
export function ThreeBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSmall = window.innerWidth < 640;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.z = 12;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // ---------- particle field ----------
    const particleCount = isSmall ? 320 : 900;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20 - 5;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: isSmall ? 0.05 : 0.06,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // ---------- floating glowing shapes ----------
    const shapes: THREE.Mesh[] = [];
    const shapeCount = isSmall ? 2 : 4;
    for (let i = 0; i < shapeCount; i++) {
      const size = 0.6 + Math.random() * 1.1;
      const geo = new THREE.IcosahedronGeometry(size, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x2563eb : 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6 - 2);
      scene.add(mesh);
      shapes.push(mesh);
    }

    const pointer = { x: 0, y: 0 };
    const hasPointer = window.matchMedia("(pointer: fine)").matches;
    function onPointerMove(e: PointerEvent) {
      pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
    }
    if (hasPointer) window.addEventListener("pointermove", onPointerMove);

    let frameId = 0;
    const clock = new THREE.Clock();
    function animate() {
      frameId = requestAnimationFrame(animate);
      const elapsed = prefersReducedMotion ? 0 : clock.getElapsedTime();
      particles.rotation.y = elapsed * 0.02;
      particles.rotation.x = elapsed * 0.01;
      shapes.forEach((mesh, i) => {
        mesh.rotation.x = elapsed * (0.08 + i * 0.02);
        mesh.rotation.y = elapsed * (0.06 + i * 0.015);
      });
      camera.position.x += (pointer.x * 0.6 - camera.position.x) * 0.03;
      camera.position.y += (-pointer.y * 0.4 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }
    animate();

    function onResize() {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      if (hasPointer) window.removeEventListener("pointermove", onPointerMove);
      geometry.dispose();
      material.dispose();
      shapes.forEach((mesh) => {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full"
    />
  );
}
