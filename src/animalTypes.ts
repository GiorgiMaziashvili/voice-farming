export const ANIMAL_TYPES = ["Cow", "Sheep", "Pig", "Chicken"] as const;

export type AnimalType = (typeof ANIMAL_TYPES)[number];

export function isAnimalType(value: string): value is AnimalType {
  return ANIMAL_TYPES.includes(value as AnimalType);
}
