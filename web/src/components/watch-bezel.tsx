"use client";

import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

export type BezelTick = { id: string; label: string; mark: string; href?: string };

const RING_SIZE = 240;
const RING_RADIUS = 88;

export const WatchBezel = ({
  label, ticks, selectedId, onSelect, centerLabel, centerMark, onCenter, centerHref, centerPressed, centerDisabled,
}: {
  label: string;
  ticks: BezelTick[];
  selectedId: string;
  onSelect?: (id: string) => void;
  centerLabel: string;
  centerMark: string;
  onCenter?: () => void;
  centerHref?: string;
  centerPressed?: boolean;
  centerDisabled?: boolean;
}) => {
  const root = useRef<HTMLDivElement>(null);
  const useRing = ticks.length > 0 && ticks.length <= 12;
  const selectedIndex = Math.max(0, ticks.findIndex(tick => tick.id === selectedId));
  const turn = ticks.length ? (selectedIndex / ticks.length) * 360 : 0;

  const focusTick = (id: string) => {
    const nodes = root.current?.querySelectorAll<HTMLElement>(`[data-tick="${CSS.escape(id)}"]`) ?? [];
    const visible = [...nodes].find(node => node.getClientRects().length > 0);
    visible?.focus();
  };
  const move = (direction: 1 | -1) => {
    if (!ticks.length) return;
    const next = ticks[(selectedIndex + direction + ticks.length) % ticks.length];
    if (onSelect) onSelect(next.id);
    else if (next.href) window.location.assign(next.href);
    requestAnimationFrame(() => focusTick(next.id));
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    move(event.key === "ArrowRight" ? 1 : -1);
  };

  const center = centerHref ? (
    <a className="bezel-center" href={centerHref} aria-label={centerLabel}>{centerMark}</a>
  ) : (
    <button type="button" className="bezel-center" aria-label={centerLabel} aria-pressed={centerPressed || undefined}
      disabled={centerDisabled} onClick={onCenter}>{centerMark}</button>
  );

  const tickNodes = (className: string) => ticks.map((tick, index) => {
    const angle = -Math.PI / 2 + (index / ticks.length) * Math.PI * 2;
    const style = className === "bezel-tick" ? {
      left: `${50 + Math.cos(angle) * (RING_RADIUS / RING_SIZE) * 100}%`,
      top: `${50 + Math.sin(angle) * (RING_RADIUS / RING_SIZE) * 100}%`,
    } : undefined;
    const selected = tick.id === selectedId;
    if (tick.href) return (
      <a key={`${className}-${tick.id}`} data-tick={tick.id} className={className} style={style} href={tick.href}
        aria-label={tick.label} aria-current={selected ? "true" : undefined}>{tick.mark}</a>
    );
    return (
      <button key={`${className}-${tick.id}`} type="button" data-tick={tick.id} className={className} style={style}
        aria-label={tick.label} aria-pressed={selected} onClick={() => onSelect?.(tick.id)}>{tick.mark}</button>
    );
  });

  return (
    <div ref={root} className={`watch-bezel ${useRing ? "is-ring" : "is-row"}`} onKeyDown={onKeyDown}>
      {useRing && <div className="bezel-circular" role="group" aria-label={label}>
        <svg className="bezel-plot" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden="true">
          <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} />
          <g style={{ transform: `rotate(${turn}deg)`, transformOrigin: `${RING_SIZE / 2}px ${RING_SIZE / 2}px` }}>
            <line x1={RING_SIZE / 2} y1={RING_SIZE / 2} x2={RING_SIZE / 2} y2={RING_SIZE / 2 - RING_RADIUS} />
          </g>
        </svg>
        {tickNodes("bezel-tick")}
        {center}
      </div>}
      <div className="bezel-linear" role="group" aria-label={label}>
        {center}
        {tickNodes("bezel-step")}
      </div>
    </div>
  );
};
