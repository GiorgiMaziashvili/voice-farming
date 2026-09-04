type TrackEntryLike = {
  mixDuration?: number;
};

type AnimationStateDataLike = {
  defaultMix: number;
  setMix(fromName: string, toName: string, duration: number): void;
};

export type AnimationStateLike = {
  data: AnimationStateDataLike;
  setAnimation(
    trackIndex: number,
    animationName: AnimalAnimationName,
    loop?: boolean,
  ): TrackEntryLike;
  setEmptyAnimation(trackIndex: number, mixDuration?: number): TrackEntryLike;
  clearTrack(trackIndex: number): void;
  clearTracks(): void;
  getCurrent(trackIndex: number): TrackEntryLike | null;
};

export type SpineLike = {
  scale: {
    x: number;
    y: number;
  };
  state: AnimationStateLike;
};

export type AnimalAnimationName =
  | "idle"
  | "walk"
  | "run"
  | "scream"
  | "react_hit"
  | "eat_chew"
  | "blink"
  | "tail_wag"
  | "select";

export type LocomotionAnimation = "idle" | "walk" | "run";

const BASE_TRACK = 0;
const VOICE_TRACK = 1;
const SECONDARY_TRACK = 2;
const DEFAULT_MIX_SECONDS = 0.18;
const SECONDARY_MIX_SECONDS = 0.15;

export class AnimalAnimationController {
  private currentLocomotion: LocomotionAnimation | null = null;
  private voiceActive = false;
  private selectedActive = false;
  private destroyed = false;

  public constructor(private readonly spine: SpineLike) {
    this.configureMixing();
    this.setLocomotion("idle");
    this.spine.scale.x = 0.5;
    this.spine.scale.y = 0.5;
  }

  public setLocomotion(animation: LocomotionAnimation): void {
    if (this.destroyed || this.currentLocomotion === animation) {
      return;
    }

    this.spine.state.setAnimation(BASE_TRACK, animation, true);
    this.currentLocomotion = animation;
  }

  public setFacingDirection(directionX: number): void {
    if (this.destroyed || directionX === 0) {
      return;
    }

    this.spine.scale.x =
      Math.abs(this.spine.scale.x) * (directionX < 0 ? -1 : 1);
  }

  public startVoice(): void {
    if (this.destroyed || this.voiceActive) {
      return;
    }

    this.spine.state.setAnimation(VOICE_TRACK, "scream", true);
    this.voiceActive = true;
  }

  public stopVoice(): void {
    if (this.destroyed || !this.voiceActive) {
      return;
    }

    this.spine.state.setEmptyAnimation(VOICE_TRACK, DEFAULT_MIX_SECONDS);
    this.voiceActive = false;
  }

  public setSelected(isSelected: boolean): void {
    if (this.destroyed || this.selectedActive === isSelected) {
      return;
    }

    if (isSelected) {
      this.spine.state.setAnimation(SECONDARY_TRACK, "select", true);
    } else {
      this.spine.state.setEmptyAnimation(
        SECONDARY_TRACK,
        SECONDARY_MIX_SECONDS,
      );
    }

    this.selectedActive = isSelected;
  }

  public playReactHit(): void {
    this.playSecondaryOnce("react_hit");
  }

  public playEatChew(): void {
    this.playSecondaryOnce("eat_chew");
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.spine.state.clearTracks();
  }

  private playSecondaryOnce(animation: AnimalAnimationName): void {
    if (this.destroyed) {
      return;
    }

    this.spine.state.setAnimation(SECONDARY_TRACK, animation, false);
  }

  private configureMixing(): void {
    const { data } = this.spine.state;

    data.defaultMix = DEFAULT_MIX_SECONDS;
    data.setMix("idle", "walk", 0.2);
    data.setMix("walk", "idle", 0.2);
    // data.setMix("walk", "run", 0.15);
    // data.setMix("run", "walk", 0.15);
    data.setMix("idle", "select", 0.15);
    data.setMix("select", "idle", 0.15);
  }
}
