import { Assets, Ticker } from "pixi.js";
import { Spine } from "@esotericsoftware/spine-pixi-v8";
import type { AnimalType } from "./animalTypes";

export type AnimalSpineAssetDefinition = {
  readonly skeletonAlias: string;
  readonly skeletonSrc: string;
  readonly atlasAlias: string;
  readonly atlasSrc: string;
  readonly scale: number;
};

function publicAssetPath(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

export const cowSpineAsset: AnimalSpineAssetDefinition = {
  skeletonAlias: "animal-spine-cow-skeleton",
  skeletonSrc: publicAssetPath("assets/spine/cow/mooglow.json"),
  atlasAlias: "animal-spine-cow-atlas",
  atlasSrc: publicAssetPath("assets/spine/cow/mooglow.atlas"),
  scale: 0.18,
};

export function createAnimalSpineAssetRegistry(
  defaultAsset: AnimalSpineAssetDefinition,
  overrides: Partial<Record<AnimalType, AnimalSpineAssetDefinition>> = {},
): Record<AnimalType, AnimalSpineAssetDefinition> {
  return {
    Cow: overrides.Cow ?? defaultAsset,
    Sheep: overrides.Sheep ?? defaultAsset,
    Pig: overrides.Pig ?? defaultAsset,
    Chicken: overrides.Chicken ?? defaultAsset,
  };
}

export const animalAssets = createAnimalSpineAssetRegistry(cowSpineAsset);

let loadingPromise: Promise<void> | null = null;

export function getAnimalSpineAsset(
  animalType: AnimalType,
): AnimalSpineAssetDefinition {
  return animalAssets[animalType];
}

export async function loadAnimalSpineAssets(): Promise<void> {
  if (loadingPromise) {
    return loadingPromise;
  }

  const uniqueAssets = [...new Set(Object.values(animalAssets))];
  const assetsToLoad = uniqueAssets.flatMap((asset) => [
    {
      alias: asset.skeletonAlias,
      src: asset.skeletonSrc,
    },
    {
      alias: asset.atlasAlias,
      src: asset.atlasSrc,
    },
  ]);

  loadingPromise = Assets.load(assetsToLoad).then(() => undefined);

  return loadingPromise;
}

export function createAnimalSpine(
  animalType: AnimalType,
  ticker: Ticker,
): Spine {
  const asset = getAnimalSpineAsset(animalType);

  return Spine.from({
    skeleton: asset.skeletonAlias,
    atlas: asset.atlasAlias,
    scale: asset.scale,
    autoUpdate: true,
    ticker,
  });
}
