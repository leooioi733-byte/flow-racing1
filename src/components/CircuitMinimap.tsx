import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { getCircuitDefinition } from '../data/circuits';
import { createCircuitSvgProjection } from '../physics/formulaPhysics';
import { DrivingTelemetry, RaceMinimapCar } from '../types/menu';

interface CircuitMinimapProps {
  circuitId?: string;
  circuitName: string;
  initialTelemetry: DrivingTelemetry;
  accentHex?: string;
}

export interface CircuitMinimapHandle {
  updateCar: (tel: DrivingTelemetry) => void;
  updateRivals: (rivals: RaceMinimapCar[]) => void;
}

const VIEW_W = 164;
const VIEW_H = 108;
const PADDING = 13;
const MAX_RIVALS = 9;

export const CircuitMinimap = forwardRef<CircuitMinimapHandle, CircuitMinimapProps>(
  function CircuitMinimap(
    { circuitId = 'costa-azul', circuitName, initialTelemetry, accentHex = '#38bdf8' },
    ref,
  ) {
    const markerGroupRef = useRef<SVGGElement | null>(null);
    const auraRef = useRef<SVGCircleElement | null>(null);
    const arrowRef = useRef<SVGPolygonElement | null>(null);
    const rivalRefs = useRef<(SVGCircleElement | null)[]>([]);

    const mapData = useMemo(
      () => createCircuitSvgProjection(VIEW_W, VIEW_H, PADDING, circuitId),
      [circuitId],
    );
    const circuitDef = useMemo(() => getCircuitDefinition(circuitId), [circuitId]);

    const applyCarTransform = (tel: DrivingTelemetry) => {
      const carPos = mapData.project(tel.x, tel.z);
      const cx = Math.max(6, Math.min(VIEW_W - 6, carPos.x));
      const cy = Math.max(6, Math.min(VIEW_H - 6, carPos.y));
      const headingDeg = ((Math.PI - tel.yaw) * 180) / Math.PI;
      const color =
        tel.surface === 'grass'
          ? '#f59e0b'
          : tel.isSliding
            ? '#fb7185'
            : accentHex;

      if (markerGroupRef.current) {
        markerGroupRef.current.setAttribute(
          'transform',
          `translate(${cx.toFixed(1)}, ${cy.toFixed(1)}) rotate(${headingDeg.toFixed(1)})`,
        );
      }
      if (auraRef.current) {
        auraRef.current.setAttribute('fill', color);
      }
      if (arrowRef.current) {
        arrowRef.current.setAttribute('fill', color);
      }
    };

    const applyRivals = (rivals: RaceMinimapCar[]) => {
      for (let i = 0; i < MAX_RIVALS; i++) {
        const el = rivalRefs.current[i];
        if (!el) continue;
        if (i < rivals.length) {
          const r = rivals[i];
          const pt = mapData.project(r.x, r.z);
          const rx = Math.max(5, Math.min(VIEW_W - 5, pt.x));
          const ry = Math.max(5, Math.min(VIEW_H - 5, pt.y));
          el.setAttribute('cx', rx.toFixed(1));
          el.setAttribute('cy', ry.toFixed(1));
          el.setAttribute('fill', r.colorHex);
          el.setAttribute('opacity', '0.95');
        } else {
          el.setAttribute('opacity', '0');
        }
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        updateCar: applyCarTransform,
        updateRivals: applyRivals,
      }),
      [mapData, accentHex],
    );

    const initPos = mapData.project(initialTelemetry.x, initialTelemetry.z);
    const initCx = Math.max(6, Math.min(VIEW_W - 6, initPos.x));
    const initCy = Math.max(6, Math.min(VIEW_H - 6, initPos.y));
    const initDeg = ((Math.PI - initialTelemetry.yaw) * 180) / Math.PI;

    return (
      <div
        className="pointer-events-none rounded-2xl bg-[#131d28]/88 border border-white/14 shadow-[0_10px_28px_rgba(0,0,0,0.42)] p-1.5 sm:p-2 w-[clamp(108px,15.5vw,166px)] shrink-0"
        aria-label={circuitName}
      >
        <div className="flex items-center justify-between gap-1 px-1 mb-0.5 sm:mb-1">
          <span className="font-display text-[9px] sm:text-[10px] font-bold tracking-[0.14em] text-white/85 uppercase truncate">
            {circuitName}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full h-auto block rounded-xl bg-[#0b131d]/90 border border-white/8"
          role="img"
          aria-label={circuitName}
        >
          {/* Coastal Ocean Bay or Foothills Contour Strip along north (-Z -> top of map) */}
          <path
            d={
              circuitDef.hasHills
                ? `M 0 0 L ${VIEW_W} 0 L ${VIEW_W} 15 Q ${VIEW_W * 0.65} 8 ${VIEW_W * 0.35} 16 T 0 12 Z`
                : `M 0 0 L ${VIEW_W} 0 L ${VIEW_W} 14 Q ${VIEW_W * 0.5} 20 0 13 Z`
            }
            fill={
              circuitDef.hasHills
                ? 'rgba(20, 184, 166, 0.14)'
                : 'rgba(14, 165, 233, 0.16)'
            }
          />

          <path
            d={mapData.pathD}
            fill="none"
            stroke="#334155"
            strokeWidth="8.5"
            strokeLinejoin="round"
          />
          <path
            d={mapData.pathD}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="4"
            strokeLinejoin="round"
          />

          <line
            x1={mapData.startPt.x}
            y1={mapData.startPt.y - 6}
            x2={mapData.startPt.x}
            y2={mapData.startPt.y + 6}
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {Array.from({ length: MAX_RIVALS }).map((_, idx) => (
            <circle
              key={idx}
              ref={(el) => {
                rivalRefs.current[idx] = el;
              }}
              cx="0"
              cy="0"
              r="3.2"
              fill="#f8fafc"
              stroke="#0f172a"
              strokeWidth="0.9"
              opacity="0"
            />
          ))}

          <g
            ref={markerGroupRef}
            transform={`translate(${initCx.toFixed(1)}, ${initCy.toFixed(1)}) rotate(${initDeg.toFixed(1)})`}
          >
            <circle ref={auraRef} r="7.5" fill={accentHex} fillOpacity="0.26" />
            <polygon
              ref={arrowRef}
              points="0,-6.5 4.8,5 0,2.5 -4.8,5"
              fill={accentHex}
              stroke="#ffffff"
              strokeWidth="1.25"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>
    );
  },
);
