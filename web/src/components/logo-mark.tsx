"use client";

import { useReducedMotion } from "framer-motion";

export const LogoMark = () => {
  const reduced = useReducedMotion();
  if (reduced !== false) {
    return <img className="logo-mark" src="/art/logo-mark-64.png" alt="" width={36} height={36} />;
  }
  return (
    <video className="logo-mark" width={36} height={36} muted loop autoPlay playsInline poster="/art/logo-mark-64.png" aria-hidden="true">
      <source src="/art/logo-mark-loop.mp4" type="video/mp4" />
    </video>
  );
};
