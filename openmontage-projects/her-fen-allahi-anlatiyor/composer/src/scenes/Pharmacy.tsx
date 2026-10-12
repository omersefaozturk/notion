import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { SceneTitle } from "../components/Primitives";
import { theme } from "../theme";

const Bottle: React.FC<{ x: number; y: number; hue: string; delay: number; frame: number }> = ({
  x,
  y,
  hue,
  delay,
  frame,
}) => {
  const pop = interpolate(frame - delay, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const h = 150;
  return (
    <g transform={`translate(${x} ${y}) scale(${0.85 + pop * 0.15})`} opacity={pop}>
      <rect x={-46} y={-h} width={92} height={h} rx={12} fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.18)" strokeWidth={2} />
      <rect x={-46} y={-h * 0.55} width={92} height={h * 0.55} rx={10} fill={hue} opacity={0.55} />
      <rect x={-30} y={-h - 18} width={60} height={20} rx={6} fill="rgba(255,255,255,0.3)" />
      <rect x={-34} y={-h * 0.82} width={68} height={30} rx={6} fill="rgba(246,243,234,0.82)" />
      <rect x={-26} y={-h * 0.78} width={40} height={5} rx={3} fill="rgba(8,12,22,0.55)" />
      <rect x={-26} y={-h * 0.70} width={52} height={5} rx={3} fill="rgba(8,12,22,0.35)" />
    </g>
  );
};

export const PharmacyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame, [0, 150], [-300, 1380]);
  const shelves = [700, 980, 1260];
  const hues = ["#54d6c4", "#e9b949", "#9fd4ff", "#f2a1a1", "#6fd08c"];

  return (
    <AbsoluteFill>
      <Backdrop seed="pharmacy" stars={60} glow="rgba(111,208,140,0.14)" />
      <AbsoluteFill style={{ paddingTop: 250, alignItems: "center" }}>
        <SceneTitle text="Bir eczane: her ilaç hassas ölçülerle" />
      </AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.14)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        {/* green pharmacy cross */}
        <g transform="translate(540 540)" opacity={interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" })}>
          <rect x={-70} y={-24} width={140} height={48} rx={10} fill={theme.green} opacity={0.9} />
          <rect x={-24} y={-70} width={48} height={140} rx={10} fill={theme.green} opacity={0.9} />
        </g>
        {shelves.map((y, si) => (
          <g key={y}>
            <rect x={120} y={y} width={840} height={12} rx={6} fill="rgba(246,243,234,0.16)" />
            {new Array(5).fill(0).map((_, i) => (
              <Bottle
                key={i}
                x={200 + i * 170}
                y={y}
                hue={hues[(i + si) % hues.length]}
                delay={si * 10 + i * 5}
                frame={frame}
              />
            ))}
          </g>
        ))}
        <rect x={sweep} y={430} width={220} height={1000} fill="url(#beam)" transform={`rotate(8 ${sweep + 110} 930)`} />
        {new Array(16).fill(0).map((_, i) => {
          const x = 140 + random(`dust-x-${i}`) * 800;
          const base = 500 + random(`dust-y-${i}`) * 850;
          const y = base - ((frame * 0.6 + i * 40) % 300);
          return <circle key={i} cx={x} cy={y} r={2.2} fill="#fff" opacity={0.18} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};
