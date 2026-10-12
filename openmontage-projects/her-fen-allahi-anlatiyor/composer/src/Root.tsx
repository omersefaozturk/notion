import React from "react";
import { Composition } from "remotion";
import { Main } from "./Main";
import timeline from "./timeline.json";

export const Root: React.FC = () => {
  const fps = timeline.fps;
  const durationInFrames = Math.ceil(timeline.duration_seconds * fps);
  return (
    <Composition
      id="Main"
      component={Main}
      durationInFrames={durationInFrames}
      fps={fps}
      width={timeline.width}
      height={timeline.height}
    />
  );
};
