"use client";

import { useEffect, useState } from "react";

export const HeroFilm = () => {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  if (reduced) {
    return <img className="hero-still" src="/art/hero-key-art-2560.webp" alt="Night storm over a flooded street. One house has its porch light on." />;
  }
  return (
    <video className="hero-loop" autoPlay muted loop playsInline poster="/art/hero-key-art-2560.webp" aria-label="Night storm over a flooded street. One house has its porch light on.">
      <source src="/art/hero-loop-web-1280.mp4" type="video/mp4" />
    </video>
  );
};
