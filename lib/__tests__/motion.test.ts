import { describe, expect, it } from "vitest";
import {
  buttonHoverScale,
  buttonTapScale,
  duration,
  easing,
  expandVariants,
  fadeVariants,
  interactiveVariants,
  shimmerVariants,
  springConfig,
  staggerContainerVariants,
  tooltipVariants,
} from "@/lib/motion";

describe("motion design tokens", () => {
  it("keeps the restrained interaction timing contract", () => {
    expect(duration).toEqual({
      instant: 0.1,
      fast: 0.15,
      normal: 0.2,
      slow: 0.3,
      slower: 0.4,
      slowest: 0.5,
    });
    expect(buttonTapScale).toBe(0.97);
    expect(buttonHoverScale).toBe(1.02);
    expect(springConfig.default).toMatchObject({ type: "spring", stiffness: 400, damping: 30 });
    expect(easing.outExpo).toEqual([0.16, 1, 0.3, 1]);
  });

  it("exports complete state variants for shared surfaces", () => {
    expect(fadeVariants).toHaveProperty("hidden");
    expect(fadeVariants).toHaveProperty("visible.transition.duration", duration.normal);
    expect(interactiveVariants).toHaveProperty("tap.scale", buttonTapScale);
    expect(expandVariants).toHaveProperty("expanded.height", "auto");
    expect(tooltipVariants).toHaveProperty("visible.scale", 1);
    expect(staggerContainerVariants).toHaveProperty("visible.transition.staggerChildren", 0.04);
    expect(shimmerVariants).toHaveProperty("animate.transition.repeat", Infinity);
  });
});
