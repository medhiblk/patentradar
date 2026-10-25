import { describe, expect, it } from "vitest";
import {
  clampTime,
  duration,
  progress,
  sceneAt,
  scenes,
} from "../src/components/patent-film/timeline";
describe("patent film editorial timeline", () => {
  it("covers 65 seconds without gaps and switches at the narration cue boundaries", () => {
    expect(duration).toBe(65);
    expect(scenes).toHaveLength(7);
    scenes.forEach((scene, index) => {
      expect(sceneAt(scene.start)).toBe(index);
      if (index > 0) {
        expect(scenes[index - 1].end).toBe(scene.start);
        expect(sceneAt(scene.start - 0.001)).toBe(index - 1);
      }
      expect(scene.end).toBeGreaterThan(scene.start);
      expect(scene.narration.length).toBeGreaterThan(20);
    });
    expect(sceneAt(65)).toBe(6);
  });
  it("keeps scrubbing and visual reveal values in bounds", () => {
    expect(clampTime(-1)).toBe(0);
    expect(clampTime(100)).toBe(65);
    expect(clampTime(NaN)).toBe(0);
    expect(progress(-3, 1, 2)).toBe(0);
    expect(progress(2, 1, 2)).toBe(0.5);
    expect(progress(9, 1, 2)).toBe(1);
  });
});
