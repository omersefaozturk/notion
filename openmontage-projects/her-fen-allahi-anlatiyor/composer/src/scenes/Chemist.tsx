import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { theme } from "../theme";

export const ChemistScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const left = spring({ frame, fps, config: { damping: 200, mass: 0.7 } });
  const right = spring({ frame: frame - 26, fps, config: { damping: 200, mass: 0.7 } });
  const arrow = interpolate(frame, [44, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bubbles = new Array(7).fill(0);

  return (
    <AbsoluteFill>
      <Backdrop seed="chemist" stars={90} glow="rgba(233,185,73,0.2)" />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 300, flexDirection: "column", gap: 0 }}>
        {/* left: the chemist */}
        <div
          style={{
            opacity: left,
            transform: `translateY(${interpolate(left, [0, 1], [50, 0])}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <svg width={300} height={300} viewBox="0 0 300 300">
            <path
              d="M120 40 L180 40 L180 120 L236 236 C 246 256 232 274 210 274 L90 274 C 68 274 54 256 64 236 L120 120 Z"
              fill="rgba(84,214,196,0.12)"
              stroke={theme.teal}
              strokeWidth={6}
            />
            <path d="M92 198 L208 198 L236 236 C 246 256 232 274 210 274 L90 274 C 68 274 54 256 64 236 Z" fill="rgba(84,214,196,0.5)" />
            {bubbles.map((_, i) => {
              const p = ((frame * 1.8 + i * 23) % 90) / 90;
              return (
                <circle
                  key={i}
                  cx={100 + ((i * 37) % 100)}
                  cy={interpolate(p, [0, 1], [268, 206])}
                  r={4 + (i % 3)}
                  fill="#eafffb"
                  opacity={interpolate(p, [0, 0.8, 1], [0.7, 0.4, 0])}
                />
              );
            })}
            <line x1={112} y1={40} x2={188} y2={40} stroke={theme.teal} strokeWidth={10} strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: theme.font, fontWeight: 900, fontSize: 52, color: theme.ink, letterSpacing: 1 }}>
            KİMYAGER
          </span>
          <span style={{ fontFamily: theme.font, fontWeight: 500, fontSize: 33, color: theme.inkSoft }}>
            ilacın ölçüsünü koyar
          </span>
        </div>

        {/* connector */}
        <svg width={200} height={190} viewBox="0 0 200 190" style={{ opacity: arrow, margin: "18px 0" }}>
          <line
            x1={100}
            y1={10}
            x2={100}
            y2={132}
            stroke={theme.gold}
            strokeWidth={6}
            strokeDasharray="14 12"
            strokeDashoffset={-frame * 1.4}
          />
          <path d="M100 176 L72 128 L128 128 Z" fill={theme.gold} transform="rotate(180 100 152)" />
        </svg>

        {/* right: the Creator */}
        <div
          style={{
            opacity: right,
            transform: `translateY(${interpolate(right, [0, 1], [50, 0])}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <svg width={330} height={300} viewBox="0 0 330 300">
            {[0, 1, 2].map((i) => (
              <ellipse
                key={i}
                cx={165}
                cy={150}
                rx={140 - i * 36}
                ry={58 - i * 14}
                fill="none"
                stroke={`rgba(233,185,73,${0.5 - i * 0.12})`}
                strokeWidth={3}
                transform={`rotate(${-22 + i * 20} 165 150)`}
              />
            ))}
            <circle cx={165} cy={150} r={34} fill={theme.goldSoft} />
            <circle cx={165} cy={150} r={56} fill="none" stroke="rgba(246,220,160,0.4)" strokeWidth={14} />
            {[0, 1, 2].map((i) => {
              const a = frame / (18 + i * 7) + i * 2;
              const rx = 140 - i * 36;
              const ry = 58 - i * 14;
              const rot = ((-22 + i * 20) * Math.PI) / 180;
              const x0 = rx * Math.cos(a);
              const y0 = ry * Math.sin(a);
              return (
                <circle
                  key={i}
                  cx={165 + x0 * Math.cos(rot) - y0 * Math.sin(rot)}
                  cy={150 + x0 * Math.sin(rot) + y0 * Math.cos(rot)}
                  r={9 - i}
                  fill={["#9fd4ff", "#f2a1a1", "#6fd08c"][i]}
                />
              );
            })}
          </svg>
          <span style={{ fontFamily: theme.font, fontWeight: 900, fontSize: 52, color: theme.gold, letterSpacing: 1 }}>
            BİR YARATICI
          </span>
          <span style={{ fontFamily: theme.font, fontWeight: 500, fontSize: 33, color: theme.inkSoft }}>
            kâinatın ölçüsünü koyar
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
