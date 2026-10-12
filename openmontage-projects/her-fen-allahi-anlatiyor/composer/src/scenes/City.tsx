import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { Panel, SceneTitle } from "../components/Primitives";
import { theme } from "../theme";

type Building = { x: number; w: number; h: number; cols: number; rows: number; seed: number };

const BUILDINGS: Building[] = new Array(11).fill(0).map((_, i) => {
  const w = 70 + Math.round(random(`bw-${i}`) * 70);
  return {
    x: 30 + i * 96,
    w,
    h: 260 + Math.round(random(`bh-${i}`) * 520),
    cols: Math.max(2, Math.round(w / 34)),
    rows: 0,
    seed: i,
  };
});

export const CityScene: React.FC = () => {
  const frame = useCurrentFrame();
  const baseline = 1230;

  return (
    <AbsoluteFill>
      <Backdrop seed="city" stars={150} glow="rgba(159,212,255,0.14)" />
      <AbsoluteFill style={{ paddingTop: 250, alignItems: "center" }}>
        <SceneTitle text="Lambaları hiç sönmeyen bir şehir" />
      </AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        {/* moon */}
        <circle cx={860} cy={560} r={52} fill="#f6f3ea" opacity={0.85} />
        <circle cx={880} cy={546} r={46} fill={theme.bgDeep} opacity={0.9} />
        {/* ground haze */}
        <rect x={0} y={baseline - 40} width={1080} height={300} fill="rgba(159,212,255,0.05)" />
        {BUILDINGS.map((b) => {
          const rows = Math.max(3, Math.floor(b.h / 54));
          const appear = interpolate(frame - b.seed * 3, [0, 16], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const h = b.h * appear;
          return (
            <g key={b.seed}>
              <rect x={b.x} y={baseline - h} width={b.w} height={h} fill="#0b1120" stroke="rgba(159,212,255,0.18)" strokeWidth={1.5} />
              {new Array(rows).fill(0).map((_, r) =>
                new Array(b.cols).fill(0).map((_, c) => {
                  const lit = random(`w-${b.seed}-${r}-${c}`) > 0.26;
                  const phase = random(`p-${b.seed}-${r}-${c}`) * Math.PI * 2;
                  const flicker = 0.55 + 0.45 * Math.abs(Math.sin(frame / 18 + phase));
                  const wy = baseline - h + 22 + r * 54;
                  if (wy > baseline - 16) return null;
                  return (
                    <rect
                      key={`${r}-${c}`}
                      x={b.x + 12 + c * ((b.w - 24) / b.cols)}
                      y={wy}
                      width={Math.max(10, (b.w - 24) / b.cols - 10)}
                      height={26}
                      rx={3}
                      fill={lit ? "#ffd98a" : "#16203a"}
                      opacity={lit ? flicker * 0.95 : 1}
                    />
                  );
                })
              )}
            </g>
          );
        })}
        <rect x={0} y={baseline} width={1080} height={10} fill="rgba(159,212,255,0.3)" />
      </svg>

      <AbsoluteFill style={{ paddingTop: 1270, alignItems: "center", flexDirection: "column", gap: 16 }}>
        <Panel style={{ width: 820, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 30px" }}>
          <span style={{ fontFamily: theme.font, fontWeight: 600, fontSize: 36, color: theme.inkSoft }}>LAMBA</span>
          <span style={{ fontFamily: theme.font, fontWeight: 900, fontSize: 48, color: theme.ink }}>
            {Math.round(interpolate(frame, [0, 60], [0, 1_000_000], { extrapolateRight: "clamp" })).toLocaleString("tr-TR")}+
          </span>
        </Panel>
        <Panel style={{ width: 820, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 30px" }}>
          <span style={{ fontFamily: theme.font, fontWeight: 600, fontSize: 36, color: theme.inkSoft }}>ENERJİ</span>
          <span style={{ fontFamily: theme.font, fontWeight: 900, fontSize: 48, color: theme.green }}>
            TÜKENMİYOR ∞
          </span>
        </Panel>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
