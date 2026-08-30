"use client";

import { useEffect, useRef } from "react";

type NavigatorWithHints = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

type WindowWithOptionalIdle = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function HeroThreeScene() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const navigatorHints = navigator as NavigatorWithHints;
    const shouldSkip = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      || window.matchMedia("(max-width: 767px)").matches
      || Boolean(navigatorHints.connection?.saveData)
      || (navigatorHints.deviceMemory !== undefined && navigatorHints.deviceMemory <= 4);
    if (shouldSkip) {
      host.dataset.threeStatus = "fallback";
      return;
    }

    let cancelled = false;
    let disposeScene: (() => void) | undefined;
    const start = async () => {
      const [three, gsapModule] = await Promise.all([import("three"), import("gsap")]);
      if (cancelled || !hostRef.current) return;
      const {
        CircleGeometry,
        DirectionalLight,
        DoubleSide,
        Euler,
        Group,
        HemisphereLight,
        InstancedMesh,
        Matrix4,
        Mesh,
        MeshBasicMaterial,
        MeshStandardMaterial,
        PerspectiveCamera,
        Quaternion,
        Scene,
        SphereGeometry,
        SRGBColorSpace,
        TorusGeometry,
        Vector3,
        WebGLRenderer,
      } = three;
      const gsap = gsapModule.gsap;
      const renderer = new WebGLRenderer({ alpha: true, antialias: window.devicePixelRatio <= 1.5, powerPreference: "high-performance" });
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.domElement.className = "hero-three-canvas";
      renderer.domElement.setAttribute("aria-hidden", "true");
      host.appendChild(renderer.domElement);

      const scene = new Scene();
      const camera = new PerspectiveCamera(34, 1, 0.1, 50);
      camera.position.set(0, 0, 6.2);
      const group = new Group();
      scene.add(group);

      const sunMaterial = new MeshStandardMaterial({ color: 0xb7312c, roughness: 0.72, metalness: 0.06 });
      const sun = new Mesh(new SphereGeometry(1.34, 48, 32), sunMaterial);
      sun.position.set(0.25, 0.08, 0);
      group.add(sun);

      const inkMaterial = new MeshStandardMaterial({ color: 0x141310, roughness: 0.5, metalness: 0.12 });
      const inkRing = new Mesh(new TorusGeometry(1.92, 0.055, 12, 180), inkMaterial);
      inkRing.rotation.set(1.05, 0.24, -0.38);
      inkRing.scale.set(1.28, 0.72, 1);
      group.add(inkRing);

      const brassMaterial = new MeshBasicMaterial({ color: 0xaa7d42, transparent: true, opacity: 0.42 });
      const brassRing = new Mesh(new TorusGeometry(2.18, 0.016, 8, 160), brassMaterial);
      brassRing.rotation.set(0.78, -0.38, 0.48);
      brassRing.scale.set(0.88, 1.08, 1);
      group.add(brassRing);

      const petalGeometry = new CircleGeometry(0.042, 6);
      const petalMaterial = new MeshBasicMaterial({ color: 0xebc9cb, transparent: true, opacity: 0.78, side: DoubleSide });
      const petals = new InstancedMesh(petalGeometry, petalMaterial, 34);
      const matrix = new Matrix4();
      const quaternion = new Quaternion();
      const scale = new Vector3();
      const position = new Vector3();
      for (let index = 0; index < 34; index += 1) {
        const angle = index * 2.399963;
        const radius = 1.65 + (index % 7) * 0.17;
        position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.72, ((index % 5) - 2) * 0.12);
        quaternion.setFromEuler(new Euler(angle * 0.3, angle * 0.2, angle));
        const size = 0.72 + (index % 4) * 0.14;
        scale.set(size, size * 1.65, size);
        matrix.compose(position, quaternion, scale);
        petals.setMatrixAt(index, matrix);
      }
      petals.instanceMatrix.needsUpdate = true;
      group.add(petals);

      scene.add(new HemisphereLight(0xfff8eb, 0x22314d, 2.1));
      const keyLight = new DirectionalLight(0xffffff, 2.8);
      keyLight.position.set(-3, 4, 5);
      scene.add(keyLight);

      let active = true;
      let lastFrame = 0;
      const resize = () => {
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        const requestedRatio = Math.min(window.devicePixelRatio || 1, 1.5);
        const maxPixels = 1_650_000;
        const ratio = Math.min(requestedRatio, Math.sqrt(maxPixels / (width * height)));
        renderer.setSize(Math.round(width * ratio), Math.round(height * ratio), false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      const intersectionObserver = new IntersectionObserver(([entry]) => { active = entry.isIntersecting; }, { threshold: 0.02 });
      intersectionObserver.observe(host);

      const rotateX = gsap.quickTo(group.rotation, "x", { duration: 0.7, ease: "power3.out" });
      const rotateY = gsap.quickTo(group.rotation, "y", { duration: 0.7, ease: "power3.out" });
      const onPointerMove = (event: PointerEvent) => {
        const rect = host.getBoundingClientRect();
        rotateY(((event.clientX - rect.left) / rect.width - 0.5) * 0.24);
        rotateX(-((event.clientY - rect.top) / rect.height - 0.5) * 0.16);
      };
      const onPointerLeave = () => { rotateX(0); rotateY(0); };
      host.addEventListener("pointermove", onPointerMove, { passive: true });
      host.addEventListener("pointerleave", onPointerLeave);

      renderer.setAnimationLoop((time) => {
        if (!active || document.hidden || time - lastFrame < 32) return;
        lastFrame = time;
        const seconds = time * 0.001;
        sun.rotation.y = seconds * 0.08;
        inkRing.rotation.z = -0.38 + Math.sin(seconds * 0.26) * 0.045;
        brassRing.rotation.z = 0.48 - seconds * 0.035;
        petals.rotation.z = seconds * 0.018;
        petals.rotation.y = Math.sin(seconds * 0.2) * 0.08;
        renderer.render(scene, camera);
      });
      host.dataset.threeStatus = "ready";

      disposeScene = () => {
        renderer.setAnimationLoop(null);
        host.removeEventListener("pointermove", onPointerMove);
        host.removeEventListener("pointerleave", onPointerLeave);
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        gsap.killTweensOf(group.rotation);
        petalGeometry.dispose();
        petalMaterial.dispose();
        sun.geometry.dispose();
        sunMaterial.dispose();
        inkRing.geometry.dispose();
        inkMaterial.dispose();
        brassRing.geometry.dispose();
        brassMaterial.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
    };

    const browserWindow = window as WindowWithOptionalIdle;
    let cancelSchedule: () => void;
    if (typeof browserWindow.requestIdleCallback === "function") {
      const idleId = browserWindow.requestIdleCallback(() => void start(), { timeout: 900 });
      cancelSchedule = () => browserWindow.cancelIdleCallback?.(idleId);
    } else {
      const timerId = window.setTimeout(() => void start(), 220);
      cancelSchedule = () => window.clearTimeout(timerId);
    }

    return () => {
      cancelled = true;
      cancelSchedule();
      disposeScene?.();
    };
  }, []);

  return <div ref={hostRef} className="hero-three" data-three-status="loading" aria-hidden="true" />;
}
