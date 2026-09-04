import {
  Bounds,
  Direction,
  Position,
  normalizeDirection,
  updateAnimalWanderPosition,
} from "./gameLogic";

export type WanderingAnimal = {
  readonly isDestroyed: boolean;
  getWanderPosition(): Position;
  setWanderPosition(position: Position): void;
  setWanderMotion?(isMoving: boolean, direction: Direction): void;
};

type AnimalWanderingSystemOptions = {
  getMoveDurationMS?: () => number;
  getPauseDurationMS?: () => number;
  getDirection?: () => Direction;
};

type WanderState =
  | {
      phase: "moving";
      direction: Direction;
      remainingMS: number;
    }
  | {
      phase: "paused";
      remainingMS: number;
    };

const ANIMAL_MOVE_MIN_DURATION_MS = 900;
const ANIMAL_MOVE_MAX_DURATION_MS = 2200;
const ANIMAL_PAUSE_MIN_DURATION_MS = 700;
const ANIMAL_PAUSE_MAX_DURATION_MS = 1800;

export class AnimalWanderingSystem {
  private readonly states = new Map<WanderingAnimal, WanderState>();
  private readonly getMoveDurationMS: () => number;
  private readonly getPauseDurationMS: () => number;
  private readonly getDirection: () => Direction;

  public constructor(options: AnimalWanderingSystemOptions = {}) {
    this.getMoveDurationMS =
      options.getMoveDurationMS ?? getRandomMoveDurationMS;
    this.getPauseDurationMS =
      options.getPauseDurationMS ?? getRandomPauseDurationMS;
    this.getDirection = options.getDirection ?? getRandomDirection;
  }

  public addAnimal(animal: WanderingAnimal): void {
    if (animal.isDestroyed) {
      return;
    }

    this.states.set(animal, this.createMoveState());
  }

  public removeAnimal(animal: WanderingAnimal): void {
    this.states.delete(animal);
  }

  public update(deltaMS: number, bounds: Bounds): void {
    for (const [animal, state] of this.states) {
      if (animal.isDestroyed) {
        this.states.delete(animal);
        continue;
      }

      if (state.phase === "moving") {
        animal.setWanderPosition(
          updateAnimalWanderPosition(
            animal.getWanderPosition(),
            state.direction,
            deltaMS,
            bounds,
          ),
        );
        animal.setWanderMotion?.(true, state.direction);
      } else {
        animal.setWanderMotion?.(false, { x: 0, y: 0 });
      }

      state.remainingMS -= deltaMS;

      if (state.remainingMS > 0) {
        continue;
      }

      this.states.set(
        animal,
        state.phase === "moving"
          ? this.createPauseState()
          : this.createMoveState(),
      );
    }
  }

  public destroy(): void {
    this.states.clear();
  }

  private createMoveState(): WanderState {
    return {
      phase: "moving",
      direction: normalizeDirection(this.getDirection()),
      remainingMS: this.getMoveDurationMS(),
    };
  }

  private createPauseState(): WanderState {
    return {
      phase: "paused",
      remainingMS: this.getPauseDurationMS(),
    };
  }
}

function getRandomMoveDurationMS(): number {
  return randomInRange(
    ANIMAL_MOVE_MIN_DURATION_MS,
    ANIMAL_MOVE_MAX_DURATION_MS,
  );
}

function getRandomPauseDurationMS(): number {
  return randomInRange(
    ANIMAL_PAUSE_MIN_DURATION_MS,
    ANIMAL_PAUSE_MAX_DURATION_MS,
  );
}

function getRandomDirection(): Direction {
  const angle = Math.random() * Math.PI * 2;

  return {
    x: Math.cos(angle),
    y: Math.sin(angle),
  };
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
