import React from "react";
import { Composition } from "remotion";
import { Main } from "./Main";
import timeline from "./timeline.json";

const OUTRO_SECONDS = 2.4;

export const Root: React.FC = () => {
  const fps = timeline.fps;
  return (
    <Composition
      id="Main"
      component={Main}
      durationInFrames={Math.ceil((timeline.duration_seconds + OUTRO_SECONDS) * fps)}
      fps={fps}
      width={timeline.width}
      height={timeline.height}
    />
  );
};
