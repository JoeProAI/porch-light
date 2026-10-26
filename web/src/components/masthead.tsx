"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "./logo-mark";

export const Masthead = ({ edition, sourceHref = "/nationwide#source-atlas", ledgerHref = "/nationwide#county-catalog" }: {
  edition?: ReactNode;
  sourceHref?: string;
  ledgerHref?: string;
}) => (
  <header className="masthead">
    <Link href="/" className="wordmark" aria-label="Porch Light call sheet"><LogoMark />Porch Light<span className="wordmark-period">.</span></Link>
    <span className="masthead-descriptor">Emergency facility outreach</span>
    <nav className="workspace-nav" aria-label="Workspace sections">
      <Link href="/">Project home</Link>
      <Link href="/nationwide">US county runs</Link>
      <Link href="/watch">Storm Watch</Link>
      <Link href={sourceHref}>Source map</Link>
      <Link href={ledgerHref}>Call order</Link>
    </nav>
    {edition ? <span className="edition">{edition}</span> : null}
  </header>
);
