import { describe, expect, it } from "vitest";
import {
  AnimalWanderingSystem,
  WanderingAnimal,
} from "./animalWanderingSystem";
import { ANIMAL_WANDER_SPEED, Bounds, Position } from "./gameLogic";

class FakeWanderingAnimal implements WanderingAnimal {
  public isDestroyed = false;
  public readonly motionCalls: {
    isMoving: boolean;
    direction: Position;
  }[] = [];
  private position: Position;

  public constructor(x: number, y: number) {
    this.position = { x, y };
  }

  public getWanderPosition(): Position {
    return { ...this.position };
  }

  public setWanderPosition(position: Position): void {
    this.position = { ...position };
  }

  public setWanderMotion(isMoving: boolean, direction: Position): void {
    this.motionCalls.push({ isMoving, direction: { ...direction } });
  }
}

const bounds: Bounds = {
  x: 0,
  y: 0,
  width: 400,
  height: 300,
};

describe("animal wandering system", () => {
  it("moves an animal during the moving phase and pauses before choosing again", () => {
    const animal = new FakeWanderingAnimal(100, 100);
    const system = new AnimalWanderingSystem({
      getDirection: () => ({ x: 1, y: 0 }),
      getMoveDurationMS: () => 1000,
      getPauseDurationMS: () => 500,
    });

    system.addAnimal(animal);
    system.update(500, bounds);

    expect(animal.getWanderPosition()).toEqual({
      x: 100 + ANIMAL_WANDER_SPEED * 0.5,
      y: 100,
    });

    system.update(500, bounds);
    const positionAfterMove = animal.getWanderPosition();

    system.update(250, bounds);
    expect(animal.getWanderPosition()).toEqual(positionAfterMove);

    system.update(250, bounds);
    system.update(500, bounds);

    expect(animal.getWanderPosition()).toEqual({
      x: positionAfterMove.x + ANIMAL_WANDER_SPEED * 0.5,
      y: positionAfterMove.y,
    });

    system.destroy();
  });

  it("removes one animal without stopping other wandering animals", () => {
    const removedAnimal = new FakeWanderingAnimal(100, 100);
    const activeAnimal = new FakeWanderingAnimal(150, 100);
    const system = new AnimalWanderingSystem({
      getDirection: () => ({ x: 1, y: 0 }),
      getMoveDurationMS: () => 1000,
      getPauseDurationMS: () => 1000,
    });

    system.addAnimal(removedAnimal);
    system.addAnimal(activeAnimal);
    system.removeAnimal(removedAnimal);
    system.update(1000, bounds);

    expect(removedAnimal.getWanderPosition()).toEqual({ x: 100, y: 100 });
    expect(activeAnimal.getWanderPosition()).toEqual({
      x: 150 + ANIMAL_WANDER_SPEED,
      y: 100,
    });

    system.destroy();
  });

  it("stops updating an animal after it is destroyed", () => {
    const animal = new FakeWanderingAnimal(100, 100);
    const system = new AnimalWanderingSystem({
      getDirection: () => ({ x: 1, y: 0 }),
      getMoveDurationMS: () => 1000,
      getPauseDurationMS: () => 1000,
    });

    system.addAnimal(animal);
    animal.isDestroyed = true;
    system.update(1000, bounds);

    expect(animal.getWanderPosition()).toEqual({ x: 100, y: 100 });

    animal.isDestroyed = false;
    system.update(1000, bounds);

    expect(animal.getWanderPosition()).toEqual({ x: 100, y: 100 });

    system.destroy();
  });

  it("reports moving and paused motion so animals can choose walk or idle", () => {
    const animal = new FakeWanderingAnimal(100, 100);
    const system = new AnimalWanderingSystem({
      getDirection: () => ({ x: -1, y: 0 }),
      getMoveDurationMS: () => 1000,
      getPauseDurationMS: () => 1000,
    });

    system.addAnimal(animal);
    system.update(500, bounds);
    system.update(500, bounds);
    system.update(500, bounds);

    expect(animal.motionCalls).toEqual([
      { isMoving: true, direction: { x: -1, y: 0 } },
      { isMoving: true, direction: { x: -1, y: 0 } },
      { isMoving: false, direction: { x: 0, y: 0 } },
    ]);

    system.destroy();
  });
});
