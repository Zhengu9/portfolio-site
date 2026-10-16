import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  phase: number;
  speed: number;
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const smallScreen = window.matchMedia("(max-width: 700px)");
    let frame = 0;
    let width = 0;
    let height = 0;
    let visible = true;
    let stars: Star[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(smallScreen.matches ? 34 : 64, Math.floor((width * height) / 19000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.15 + 0.25,
        alpha: Math.random() * 0.38 + 0.16,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.0007 + 0.0002,
      }));
      paint(0);
    };

    const paint = (time: number) => {
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        const flicker = reducedMotion.matches
          ? star.alpha
          : star.alpha * (0.72 + Math.sin(time * star.speed + star.phase) * 0.28);
        context.beginPath();
        context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(205, 225, 224, ${flicker})`;
        context.fill();
      }
      if (visible && !reducedMotion.matches) frame = requestAnimationFrame(paint);
    };

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      cancelAnimationFrame(frame);
      if (visible && !reducedMotion.matches) frame = requestAnimationFrame(paint);
    };
    const onMotionChange = () => {
      cancelAnimationFrame(frame);
      if (reducedMotion.matches) paint(0);
      else if (visible) frame = requestAnimationFrame(paint);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    reducedMotion.addEventListener("change", onMotionChange);
    if (!reducedMotion.matches) frame = requestAnimationFrame(paint);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="starfield" aria-hidden="true" />;
}
