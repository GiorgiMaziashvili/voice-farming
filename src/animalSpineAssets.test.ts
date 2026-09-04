import { describe, expect, it } from "vitest";
import { ANIMAL_TYPES } from "./animalTypes";
import {
  animalAssets,
  cowSpineAsset,
  createAnimalSpineAssetRegistry,
  getAnimalSpineAsset,
} from "./animalSpineAssets";

describe("animal Spine assets", () => {
  it("maps every animal type to the cow Spine asset for now", () => {
    const cowAsset = getAnimalSpineAsset("Cow");

    for (const animalType of ANIMAL_TYPES) {
      expect(getAnimalSpineAsset(animalType)).toBe(cowAsset);
      expect(animalAssets[animalType].skeletonSrc).toBe(
        `${import.meta.env.BASE_URL}assets/spine/cow/mooglow.json`,
      );
      expect(animalAssets[animalType].atlasSrc).toBe(
        `${import.meta.env.BASE_URL}assets/spine/cow/mooglow.atlas`,
      );
    }
  });

  it("keeps the registry keyed by animal type for future asset replacement", () => {
    expect(Object.keys(animalAssets).sort()).toEqual([...ANIMAL_TYPES].sort());
  });

  it("can replace one animal asset without changing the other mappings", () => {
    const sheepAsset = {
      skeletonAlias: "animal-spine-sheep-skeleton",
      skeletonSrc: "/assets/spine/sheep/sheep.json",
      atlasAlias: "animal-spine-sheep-atlas",
      atlasSrc: "/assets/spine/sheep/sheep.atlas",
      scale: 0.2,
    };

    const registry = createAnimalSpineAssetRegistry(cowSpineAsset, {
      Sheep: sheepAsset,
    });

    expect(registry.Sheep).toBe(sheepAsset);
    expect(registry.Cow).toBe(cowSpineAsset);
    expect(registry.Pig).toBe(cowSpineAsset);
    expect(registry.Chicken).toBe(cowSpineAsset);
  });
});
