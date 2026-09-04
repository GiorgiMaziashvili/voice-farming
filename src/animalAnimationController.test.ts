import { describe, expect, it } from "vitest";
import { AnimalAnimationController } from "./animalAnimationController";
import type {
  AnimalAnimationName,
  AnimationStateLike,
} from "./animalAnimationController";

class FakeAnimationState implements AnimationStateLike {
  public readonly calls: string[] = [];
  public readonly data = {
    defaultMix: 0,
    mixes: new Map<string, number>(),
    setMix: (fromName: string, toName: string, duration: number) => {
      this.data.mixes.set(`${fromName}->${toName}`, duration);
    },
  };

  public setAnimation(
    trackIndex: number,
    animationName: AnimalAnimationName,
    loop = false,
  ) {
    this.calls.push(`set:${trackIndex}:${animationName}:${loop}`);
    return {};
  }

  public setEmptyAnimation(trackIndex: number, mixDuration = 0) {
    this.calls.push(`empty:${trackIndex}:${mixDuration}`);
    return {};
  }

  public clearTrack(trackIndex: number): void {
    this.calls.push(`clear:${trackIndex}`);
  }

  public clearTracks(): void {
    this.calls.push("clear-all");
  }

  public getCurrent() {
    return null;
  }
}

function createFakeSpine() {
  return {
    scale: { x: 1, y: 1 },
    state: new FakeAnimationState(),
  };
}

describe("animal animation controller", () => {
  it("configures animation mixing and starts idle once", () => {
    const spine = createFakeSpine();

    new AnimalAnimationController(spine);

    expect(spine.state.data.defaultMix).toBe(0.18);
    expect(spine.state.data.mixes.get("idle->walk")).toBe(0.2);
    expect(spine.state.data.mixes.get("walk->idle")).toBe(0.2);
    expect(spine.state.data.mixes.get("walk->run")).toBe(0.15);
    expect(spine.state.data.mixes.get("run->walk")).toBe(0.15);
    expect(spine.state.calls).toEqual(["set:0:idle:true"]);
  });

  it("does not restart the same locomotion animation repeatedly", () => {
    const spine = createFakeSpine();
    const controller = new AnimalAnimationController(spine);

    controller.setLocomotion("walk");
    controller.setLocomotion("walk");
    controller.setLocomotion("idle");

    expect(spine.state.calls).toEqual([
      "set:0:idle:true",
      "set:0:walk:true",
      "set:0:idle:true",
    ]);
  });

  it("uses a separate voice track and clears it smoothly", () => {
    const spine = createFakeSpine();
    const controller = new AnimalAnimationController(spine);

    controller.startVoice();
    controller.startVoice();
    controller.stopVoice();

    expect(spine.state.calls).toEqual([
      "set:0:idle:true",
      "set:1:talk_scream:true",
      "empty:1:0.18",
    ]);
  });

  it("uses a separate selected track and ignores callbacks after destroy", () => {
    const spine = createFakeSpine();
    const controller = new AnimalAnimationController(spine);

    controller.setSelected(true);
    controller.setSelected(true);
    controller.setSelected(false);
    controller.destroy();
    controller.setLocomotion("walk");
    controller.startVoice();
    controller.setSelected(true);

    expect(spine.state.calls).toEqual([
      "set:0:idle:true",
      "set:2:selected:true",
      "empty:2:0.15",
      "clear-all",
    ]);
  });

  it("flips horizontally only from horizontal movement", () => {
    const spine = createFakeSpine();
    const controller = new AnimalAnimationController(spine);

    controller.setFacingDirection(-1);
    expect(spine.scale.x).toBe(-1);

    controller.setFacingDirection(0);
    expect(spine.scale.x).toBe(-1);

    controller.setFacingDirection(1);
    expect(spine.scale.x).toBe(1);
  });
});
