import story from "./story.json";
export const scenes = story;
export const duration = scenes[scenes.length - 1].end;
export const clampTime = (time: number) =>
  Math.max(0, Math.min(duration, Number.isFinite(time) ? time : 0));
export function sceneAt(time: number) {
  return Math.max(
    0,
    scenes.findLastIndex((scene) => clampTime(time) >= scene.start),
  );
}
export const progress = (time: number, start: number, length: number) =>
  Math.max(0, Math.min(1, (time - start) / length));
export const timecode = (time: number) =>
  `0:${Math.floor(time).toString().padStart(2, "0")}`;
