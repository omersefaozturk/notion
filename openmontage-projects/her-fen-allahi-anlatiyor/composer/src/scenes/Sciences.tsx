import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { Panel, Reveal } from "../components/Primitives";
import { theme } from "../theme";

const Atom: React.FC<{ frame: number }> = ({ frame }) => (
  <svg width={128} height={128} viewBox="0 0 128 128">
    <circle cx={64} cy={64} r={13} fill={theme.teal} />
    {[0, 60, 120].map((rot, i) => (
      <g key={i} transform={`rotate(${rot} 64 64)`}>
        <ellipse cx={64} cy={64} rx={50} ry={20} fill="none" stroke="rgba(84,214,196,0.5)" strokeWidth={3} />
        <circle
          cx={64 + 50 * Math.cos((frame / 14) + i * 2.1)}
          cy={64 + 20 * Math.sin((frame / 14) + i * 2.1)}
          r={7}
          fill={theme.goldSoft}
        />
      </g>
    ))}
  </svg>
);

const Pulse: React.FC<{ frame: number }> = ({ frame }) => {
  const dash = 420;
  const offset = interpolate(frame % 60, [0, 60], [dash, -dash]);
  return (
    <svg width={128} height={128} viewBox="0 0 128 128">
      <path
        d="M6 72 H34 L44 40 L56 100 L70 58 L80 72 H122"
        fill="none"
        stroke={theme.warn}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.35}
      />
      <path
        d="M6 72 H34 L44 40 L56 100 L70 58 L80 72 H122"
        fill="none"
        stroke={theme.warn}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`90 ${dash}`}
        strokeDashoffset={offset}
      />
    </svg>
  );
};

const Orbit: React.FC<{ frame: number }> = ({ frame }) => (
  <svg width={128} height={128} viewBox="0 0 128 128">
    <circle cx={64} cy={64} r={17} fill={theme.gold} />
    <circle cx={64} cy={64} r={17} fill="none" stroke="rgba(233,185,73,0.4)" strokeWidth={10} />
    <ellipse cx={64} cy={64} rx={52} ry={52} fill="none" stroke="rgba(246,243,234,0.22)" strokeWidth={2} />
    <circle
      cx={64 + 52 * Math.cos(frame / 20)}
      cy={64 + 52 * Math.sin(frame / 20)}
      r={9}
      fill="#9fd4ff"
    />
    <ellipse cx={64} cy={64} rx={34} ry={34} fill="none" stroke="rgba(246,243,234,0.14)" strokeWidth={2} />
    <circle
      cx={64 + 34 * Math.cos(-frame / 13 + 2)}
      cy={64 + 34 * Math.sin(-frame / 13 + 2)}
      r={6}
      fill="#f2a1a1"
    />
  </svg>
);

const rows = [
  { key: "kimya", name: "KİMYA", desc: "maddenin yapısını inceler", art: "atom" },
  { key: "tip", name: "TIP", desc: "insan vücudunu inceler", art: "pulse" },
  { key: "astro", name: "ASTRONOMİ", desc: "yıldızları ve gezegenleri inceler", art: "orbit" },
];

export const SciencesScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop seed="sciences" stars={110} glow="rgba(84,214,196,0.14)" />
      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center", gap: 36, flexDirection: "column", paddingBottom: 300 }}
      >
        {rows.map((r, i) => (
          <Reveal key={r.key} delay={i * 12} from={60}>
            <Panel style={{ width: 840, display: "flex", alignItems: "center", gap: 34 }}>
              <div style={{ width: 128, height: 128, flexShrink: 0 }}>
                {r.art === "atom" ? <Atom frame={frame} /> : null}
                {r.art === "pulse" ? <Pulse frame={frame} /> : null}
                {r.art === "orbit" ? <Orbit frame={frame} /> : null}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span
                  style={{
                    fontFamily: theme.font,
                    fontWeight: 900,
                    fontSize: 54,
                    letterSpacing: 1,
                    color: theme.ink,
                  }}
                >
                  {r.name}
                </span>
                <span
                  style={{
                    fontFamily: theme.font,
                    fontWeight: 500,
                    fontSize: 34,
                    color: theme.inkSoft,
                  }}
                >
                  {r.desc}
                </span>
              </div>
            </Panel>
          </Reveal>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
