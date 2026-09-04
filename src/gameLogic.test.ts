import { describe, expect, it } from "vitest";
import {
  PLAYER_SIZE,
  PLAYER_SPEED,
  ANIMAL_WANDER_SPEED,
  ANIMAL_FOOTPRINT_HEIGHT,
  ANIMAL_FOOTPRINT_WIDTH,
  ANIMAL_SIZE,
  calculateAnimalPlacementPosition,
  calculateDistanceVolume,
  getMovementDirection,
  isMovementKey,
  normalizeDirection,
  updateAnimalWanderPosition,
  updatePlayerPosition,
} from "./gameLogic";

const bounds = {
  x: 0,
  y: 0,
  width: 100,
  height: 80,
};

const openBounds = {
  x: 0,
  y: 0,
  width: 400,
  height: 300,
};

const fullVolumeDistance = 100;
const maxDistance = 500;

describe("game logic", () => {
  it("maps WASD and arrow keys to movement directions", () => {
    expect(getMovementDirection(new Set(["w"]))).toEqual({ x: 0, y: -1 });
    expect(getMovementDirection(new Set(["ArrowRight"]))).toEqual({
      x: 1,
      y: 0,
    });
    expect(getMovementDirection(new Set(["a", "d"]))).toEqual({ x: 0, y: 0 });
  });

  it("recognizes movement keys without case sensitivity", () => {
    expect(isMovementKey("W")).toBe(true);
    expect(isMovementKey("ArrowLeft")).toBe(true);
    expect(isMovementKey("Enter")).toBe(false);
  });

  it("normalizes diagonal movement so it is not faster", () => {
    expect(normalizeDirection({ x: 1, y: 1 })).toEqual({
      x: Math.SQRT1_2,
      y: Math.SQRT1_2,
    });
  });

  it("moves the player using delta milliseconds", () => {
    expect(
      updatePlayerPosition({ x: 10, y: 10 }, { x: 1, y: 0 }, 500, openBounds),
    ).toEqual({
      x: 10 + PLAYER_SPEED * 0.5,
      y: 10,
    });
  });

  it("keeps the player inside the game bounds", () => {
    expect(
      updatePlayerPosition({ x: 90, y: 70 }, { x: 1, y: 1 }, 1000, bounds),
    ).toEqual({
      x: bounds.width - PLAYER_SIZE,
      y: bounds.height - PLAYER_SIZE,
    });

    expect(
      updatePlayerPosition({ x: 4, y: 3 }, { x: -1, y: -1 }, 1000, bounds),
    ).toEqual({ x: 0, y: 0 });
  });

  it("uses full animal volume when the player is very close", () => {
    expect(
      calculateDistanceVolume(
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        fullVolumeDistance,
        maxDistance,
      ),
    ).toBe(1);
  });

  it("uses full animal volume exactly at fullVolumeDistance", () => {
    expect(
      calculateDistanceVolume(
        { x: 0, y: 0 },
        { x: fullVolumeDistance, y: 0 },
        fullVolumeDistance,
        maxDistance,
      ),
    ).toBe(1);
  });

  it("smoothly lowers animal volume at the middle distance", () => {
    expect(
      calculateDistanceVolume(
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        fullVolumeDistance,
        maxDistance,
      ),
    ).toBeCloseTo(0.5);
  });

  it("mutes animal volume exactly at maxDistance", () => {
    expect(
      calculateDistanceVolume(
        { x: 0, y: 0 },
        { x: maxDistance, y: 0 },
        fullVolumeDistance,
        maxDistance,
      ),
    ).toBe(0);
  });

  it("mutes animal volume farther than maxDistance", () => {
    expect(
      calculateDistanceVolume(
        { x: 0, y: 0 },
        { x: 700, y: 0 },
        fullVolumeDistance,
        maxDistance,
      ),
    ).toBe(0);
  });

  it("keeps the full rendered animal footprint inside bounds", () => {
    const position = calculateAnimalPlacementPosition(
      { x: 1000, y: 1000 },
      bounds,
    );
    const horizontalPadding = (ANIMAL_FOOTPRINT_WIDTH - ANIMAL_SIZE) / 2;

    expect(position).toEqual({
      x: bounds.width - ANIMAL_SIZE - horizontalPadding,
      y: bounds.height - ANIMAL_FOOTPRINT_HEIGHT,
    });
    expect(position.x - horizontalPadding).toBeGreaterThanOrEqual(bounds.x);
    expect(position.x + ANIMAL_SIZE + horizontalPadding).toBeLessThanOrEqual(
      bounds.width,
    );
    expect(position.y + ANIMAL_FOOTPRINT_HEIGHT).toBeLessThanOrEqual(
      bounds.height,
    );
  });

  it("moves wandering animals with delta milliseconds and clamps their full footprint", () => {
    const horizontalPadding = (ANIMAL_FOOTPRINT_WIDTH - ANIMAL_SIZE) / 2;

    expect(
      updateAnimalWanderPosition(
        { x: 100, y: 100 },
        { x: 1, y: 0 },
        500,
        openBounds,
      ),
    ).toEqual({
      x: 100 + ANIMAL_WANDER_SPEED * 0.5,
      y: 100,
    });

    const clampedPosition = updateAnimalWanderPosition(
      { x: 390, y: 290 },
      { x: 1, y: 1 },
      1000,
      openBounds,
    );

    expect(clampedPosition).toEqual({
      x: openBounds.width - ANIMAL_SIZE - horizontalPadding,
      y: openBounds.height - ANIMAL_FOOTPRINT_HEIGHT,
    });
    expect(clampedPosition.x - horizontalPadding).toBeGreaterThanOrEqual(
      openBounds.x,
    );
    expect(
      clampedPosition.x + ANIMAL_SIZE + horizontalPadding,
    ).toBeLessThanOrEqual(openBounds.width);
    expect(clampedPosition.y + ANIMAL_FOOTPRINT_HEIGHT).toBeLessThanOrEqual(
      openBounds.height,
    );
  });
});
