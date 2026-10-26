"use client";

import { useEffect, useRef, useState } from "react";

type Drop = { x: number; y: number; length: number; speed: number; drift: number; alpha: number };

const spawn = (width: number, height: number, anywhere: boolean): Drop => ({
  x: Math.random() * width,
  y: anywhere ? Math.random() * height : -16,
  length: 5 + Math.random() * 11,
  speed: 3.2 + Math.random() * 6.4,
  drift: 0.25 + Math.random() * 0.7,
  alpha: 0.07 + Math.random() * 0.16,
});

const HeroRain = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;
    const drops: Drop[] = [];
    let frame = 0;
    let running = true;
    const layout = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.max(28, Math.round((width * height) / 16000));
      drops.length = 0;
      for (let index = 0; index < count; index += 1) drops.push(spawn(width, height, true));
    };
    const tick = () => {
      if (!running) return;
      if (document.hidden) {
        frame = window.requestAnimationFrame(tick);
        return;
      }
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);
      context.lineCap = "round";
      context.lineWidth = 1.05;
      for (const drop of drops) {
        context.strokeStyle = `rgba(226, 236, 255, ${drop.alpha})`;
        context.beginPath();
        context.moveTo(drop.x, drop.y);
        context.lineTo(drop.x + drop.drift * 0.4, drop.y + drop.length);
        context.stroke();
        drop.x += drop.drift;
        drop.y += drop.speed;
        if (drop.y > height + 18 || drop.x > width + 12) {
          const next = spawn(width, height, false);
          drop.x = next.x;
          drop.y = next.y;
          drop.length = next.length;
          drop.speed = next.speed;
          drop.drift = next.drift;
          drop.alpha = next.alpha;
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    layout();
    const observer = new ResizeObserver(layout);
    observer.observe(canvas);
    frame = window.requestAnimationFrame(tick);
    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);
  return <canvas className="hero-rain" ref={canvasRef} aria-hidden="true" data-rain="particles" />;
};

export const HeroFilm = () => {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return (
    <>
      {reduced
        ? <img className="hero-still" src="/art/hero-key-art-2560.webp" alt="Night storm over a flooded street. One house has its porch light on." />
        : (
          <video className="hero-loop" autoPlay muted loop playsInline poster="/art/hero-key-art-2560.webp" aria-label="Night storm over a flooded street. One house has its porch light on.">
            <source src="/art/hero-loop-web-1280.mp4" type="video/mp4" />
          </video>
        )}
      {!reduced && <HeroRain />}
    </>
  );
};
