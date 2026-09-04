export type Direction = {
  x: number;
  y: number;
};

export type Position = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type Bounds = Position & Size;

export const PLAYER_SIZE = 32;
export const PLAYER_SPEED = 260;
export const ANIMAL_SIZE = 72;
export const ANIMAL_FOOTPRINT_WIDTH = 96;
export const ANIMAL_FOOTPRINT_HEIGHT = 90;
export const ANIMAL_WANDER_SPEED = 55;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function calculateDistanceVolume(
  playerPosition: Position,
  animalPosition: Position,
  fullVolumeDistance: number,
  maxDistance: number,
): number {
  const distance = Math.hypot(
    playerPosition.x - animalPosition.x,
    playerPosition.y - animalPosition.y,
  );

  if (distance <= fullVolumeDistance) {
    return 1;
  }

  if (distance >= maxDistance) {
    return 0;
  }

  const range = maxDistance - fullVolumeDistance;
  const progress = (distance - fullVolumeDistance) / range;
  const smoothedProgress = progress * progress * (3 - 2 * progress);
  const volume = 1 - smoothedProgress;

  return clamp(volume, 0, 1);
}

export function normalizeDirection(direction: Direction): Direction {
  if (direction.x === 0 || direction.y === 0) {
    return { ...direction };
  }

  return {
    x: direction.x * Math.SQRT1_2,
    y: direction.y * Math.SQRT1_2,
  };
}

export function getMovementDirection(
  pressedKeys: ReadonlySet<string>,
): Direction {
  const left =
    isPressed(pressedKeys, "a") || isPressed(pressedKeys, "arrowleft");
  const right =
    isPressed(pressedKeys, "d") || isPressed(pressedKeys, "arrowright");
  const up = isPressed(pressedKeys, "w") || isPressed(pressedKeys, "arrowup");
  const down =
    isPressed(pressedKeys, "s") || isPressed(pressedKeys, "arrowdown");

  return normalizeDirection({
    x: Number(right) - Number(left),
    y: Number(down) - Number(up),
  });
}

export function isMovementKey(key: string): boolean {
  return [
    "a",
    "d",
    "s",
    "w",
    "arrowleft",
    "arrowright",
    "arrowup",
    "arrowdown",
  ].includes(key.toLowerCase());
}

export function updatePlayerPosition(
  position: Position,
  direction: Direction,
  deltaMS: number,
  bounds: Bounds,
): Position {
  const deltaSeconds = deltaMS / 1000;
  const nextX = position.x + direction.x * PLAYER_SPEED * deltaSeconds;
  const nextY = position.y + direction.y * PLAYER_SPEED * deltaSeconds;

  return {
    x: clamp(nextX, bounds.x, bounds.x + bounds.width - PLAYER_SIZE),
    y: clamp(nextY, bounds.y, bounds.y + bounds.height - PLAYER_SIZE),
  };
}

export function calculateAnimalPlacementPosition(
  targetPosition: Position,
  bounds: Bounds,
): Position {
  const footprintOffsetX = (ANIMAL_FOOTPRINT_WIDTH - ANIMAL_SIZE) / 2;
  const requestedX = targetPosition.x - ANIMAL_SIZE / 2;
  const requestedY = targetPosition.y - ANIMAL_SIZE / 2;

  return {
    x: clamp(
      requestedX,
      bounds.x + footprintOffsetX,
      bounds.x + bounds.width - ANIMAL_SIZE - footprintOffsetX,
    ),
    y: clamp(
      requestedY,
      bounds.y,
      bounds.y + bounds.height - ANIMAL_FOOTPRINT_HEIGHT,
    ),
  };
}

export function updateAnimalWanderPosition(
  position: Position,
  direction: Direction,
  deltaMS: number,
  bounds: Bounds,
): Position {
  const footprintOffsetX = (ANIMAL_FOOTPRINT_WIDTH - ANIMAL_SIZE) / 2;
  const deltaSeconds = deltaMS / 1000;
  const nextX = position.x + direction.x * ANIMAL_WANDER_SPEED * deltaSeconds;
  const nextY = position.y + direction.y * ANIMAL_WANDER_SPEED * deltaSeconds;

  return {
    x: clamp(
      nextX,
      bounds.x + footprintOffsetX,
      bounds.x + bounds.width - ANIMAL_SIZE - footprintOffsetX,
    ),
    y: clamp(
      nextY,
      bounds.y,
      bounds.y + bounds.height - ANIMAL_FOOTPRINT_HEIGHT,
    ),
  };
}

function isPressed(pressedKeys: ReadonlySet<string>, key: string): boolean {
  const normalizedKey = key.toLowerCase();

  for (const pressedKey of pressedKeys) {
    if (pressedKey.toLowerCase() === normalizedKey) {
      return true;
    }
  }

  return false;
}
