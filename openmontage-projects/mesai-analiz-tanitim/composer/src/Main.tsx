import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import timeline from "./timeline.json";
import shotsData from "./shots.json";
import { Captions, type Caption } from "./components/Captions";
import { UiShot, type Shot } from "./components/UiShot";
import { Window } from "./components/Window";
import { theme } from "./theme";

const CROSSFADE = 8;
const SHOTS: Record<string, Shot> = Object.fromEntries(
  (shotsData.shots as Shot[]).map((s) => [s.id, s])
);

export const Main: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const segments = timeline.segments;

  const windows = segments.map((seg, i) => {
    const next = segments[i + 1];
    const startSec = i === 0 ? 0 : seg.start - 0.16;
    const endSec = next ? next.start - 0.16 : timeline.duration_seconds;
    return { seg, from: Math.round(startSec * fps), to: Math.round(endSec * fps) };
  });

  const captions: Caption[] = segments.flatMap((s) => s.captions as Caption[]);
  const stepIndex = windows.findIndex((w) => frame >= w.from && frame < w.to);
  const step = `${Math.max(1, stepIndex + 1)}/${segments.length}`;

  const outroStart = Math.round(timeline.duration_seconds * fps) - Math.round(fps * 1.0);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bgDeep }}>
      <Audio src={staticFile("mix.wav")} />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(90% 70% at 50% 0%, #16203A 0%, #0C1322 45%, #070C16 100%)",
        }}
      />

      <Window step={step}>
        {windows.map(({ seg, from, to }, i) => {
          const shot = SHOTS[seg.scene];
          if (!shot) return null;
          const pre = i === 0 ? 0 : CROSSFADE;
          const duration = Math.max(1, to - from + pre);
          return (
            <Sequence key={seg.id} from={Math.max(0, from - pre)} durationInFrames={duration} layout="none">
              <FadeIn frames={i === 0 ? 12 : CROSSFADE}>
                <UiShot shot={shot} durationInFrames={duration} />
              </FadeIn>
            </Sequence>
          );
        })}
      </Window>

      <Title />
      <Captions captions={captions} />

      <Sequence from={outroStart} layout="none">
        <Outro />
      </Sequence>

      <AbsoluteFill
        style={{
          backgroundColor: "#000",
          pointerEvents: "none",
          opacity: interpolate(
            frame,
            [0, 12, durationInFrames - 18, durationInFrames - 1],
            [1, 0, 0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          ),
        }}
      />
    </AbsoluteFill>
  );
};

/** Opening lower-third over the landing page. */
const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inT = spring({ frame: frame - 10, fps, config: { damping: 200, mass: 0.7 } });
  const out = interpolate(frame, [Math.round(fps * 4.6), Math.round(fps * 5.2)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (frame > fps * 5.3) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 240,
        top: 1000,
        opacity: inT * out,
        transform: `translateY(${interpolate(inT, [0, 1], [18, 0])}px)`,
      }}
    >
      <span
        style={{
          fontFamily: theme.font,
          fontWeight: 800,
          fontSize: 30,
          letterSpacing: 5,
          color: theme.inkSoft,
        }}
      >
        ARAYÜZ REHBERİ
      </span>
    </div>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame, fps, config: { damping: 200, mass: 0.8 } });
  return (
    <AbsoluteFill
      style={{
        background: "rgba(7, 12, 22, 0.96)",
        backdropFilter: "blur(8px)",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 18,
        opacity: t,
      }}
    >
      <span
        style={{
          fontFamily: theme.font,
          fontWeight: 900,
          fontSize: 76,
          letterSpacing: -2,
          color: theme.ink,
          transform: `translateY(${interpolate(t, [0, 1], [24, 0])}px)`,
        }}
      >
        BDKS Mesai Analizi
      </span>
      <span style={{ fontFamily: theme.font, fontWeight: 500, fontSize: 36, color: theme.inkSoft }}>
        Tek HTML dosyası · tarayıcıda çalışır · veri dışarı çıkmaz
      </span>
      <div style={{ height: 10 }} />
      <span
        style={{
          fontFamily: theme.mono,
          fontSize: 28,
          color: theme.ring,
          border: `2px solid rgba(255,176,32,0.4)`,
          borderRadius: 999,
          padding: "12px 28px",
        }}
      >
        Örnek veriyle göz at → hemen deneyin
      </span>
    </AbsoluteFill>
  );
};

const FadeIn: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, frames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};
