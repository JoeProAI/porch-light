"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

export const LogoMark = () => {
  const reduced = useReducedMotion();
  // The server can't read the motion preference, so it always renders the still frame. Switch to the loop only after hydration.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  if (!hydrated || reduced !== false) {
    return <img className="logo-mark" src="/art/logo-mark-64.png" alt="" width={36} height={36} />;
  }
  return (
    <video className="logo-mark" width={36} height={36} muted loop autoPlay playsInline poster="/art/logo-mark-64.png" aria-hidden="true">
      <source src="/art/logo-mark-loop.mp4" type="video/mp4" />
    </video>
  );
};
