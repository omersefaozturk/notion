import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import timeline from "./timeline.json";
import { Captions, type Caption } from "./components/Captions";
import { Chrome } from "./components/Chrome";
import {
  AppleScene,
  BodyScene,
  ChemistScene,
  CityScene,
  ClosingScene,
  DosageScene,
  FruitsScene,
  PharmacyScene,
  SciencesScene,
  SoilScene,
  StarsScene,
  SunScene,
  TasteScene,
  TitleScene,
} from "./scenes";

const SCENES: Record<string, React.FC> = {
  title: TitleScene,
  sciences: SciencesScene,
  pharmacy: PharmacyScene,
  dosage: DosageScene,
  apple: AppleScene,
  body: BodyScene,
  chemist: ChemistScene,
  fruits: FruitsScene,
  soil: SoilScene,
  taste: TasteScene,
  city: CityScene,
  sun: SunScene,
  stars: StarsScene,
  closing: ClosingScene,
};

/** Discipline chip shown in the top chrome per scene. */
const LABELS: Record<string, string | undefined> = {
  title: undefined,
  sciences: "FEN İLİMLERİ",
  pharmacy: "KİMYA",
  dosage: "KİMYA · ÖLÇÜ",
  apple: "BİYOLOJİ",
  body: "TIP",
  chemist: "KİMYA → KÂİNAT",
  fruits: "ZİRAAT",
  soil: "ZİRAAT",
  taste: "ZİRAAT",
  city: "ELEKTRİK",
  sun: "ASTRONOMİ",
  stars: "ASTRONOMİ",
  closing: undefined,
};

const CROSSFADE = 9; // frames of overlap between scenes

export const Main: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const segments = timeline.segments;

  const windows = segments.map((seg, i) => {
    const next = segments[i + 1];
    const startSec = i === 0 ? 0 : seg.start - 0.16;
    const endSec = next ? next.start - 0.16 : timeline.duration_seconds;
    const from = Math.round(startSec * fps);
    const to = Math.round(endSec * fps);
    return { seg, from, to };
  });

  const captions: Caption[] = segments.flatMap((s) => s.captions as Caption[]);
  const activeLabel = windows.find((w) => frame >= w.from && frame < w.to)?.seg.scene ?? "closing";

  return (
    <AbsoluteFill style={{ backgroundColor: "#030509" }}>
      <Audio src={staticFile("mix.wav")} />

      {windows.map(({ seg, from, to }, i) => {
        const Scene = SCENES[seg.scene];
        if (!Scene) return null;
        const pre = i === 0 ? 0 : CROSSFADE;
        return (
          <Sequence
            key={seg.id}
            from={Math.max(0, from - pre)}
            durationInFrames={Math.max(1, to - from + pre)}
            layout="none"
          >
            <FadeIn frames={i === 0 ? 14 : CROSSFADE}>
              <Scene />
            </FadeIn>
          </Sequence>
        );
      })}

      <Captions captions={captions} />
      <Chrome label={LABELS[activeLabel]} />

      {/* opening and closing dips to black */}
      <AbsoluteFill
        style={{
          backgroundColor: "#000",
          pointerEvents: "none",
          opacity: interpolate(
            frame,
            [0, 14, durationInFrames - 26, durationInFrames - 2],
            [1, 0, 0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          ),
        }}
      />
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
