import { Position, calculateDistanceVolume } from "./gameLogic";

export type SoundAnimal = {
  readonly isDestroyed: boolean;
  getSoundPosition(): Position;
  openMouth(): void;
  closeMouth(): void;
};

export type VoicePlayer = {
  hasRecording(animal: SoundAnimal): boolean;
  playRecording(
    animal: SoundAnimal,
    volume: number,
    onFinished?: () => void,
  ): boolean;
};

type TimerID = ReturnType<typeof setTimeout>;

type TimerAPI = {
  setTimeout(handler: () => void, delayMS: number): TimerID;
  clearTimeout(id: TimerID): void;
};

type AnimalSoundSystemOptions = {
  getPlayerPosition: () => Position;
  getSoundDelayMS?: () => number;
  timers?: TimerAPI;
};

const ANIMAL_SOUND_MIN_DELAY_MS = 3000;
const ANIMAL_SOUND_MAX_DELAY_MS = 7000;
const FULL_VOLUME_DISTANCE = 100;
const MAX_SOUND_DISTANCE = 500;

const browserTimers: TimerAPI = {
  setTimeout: (handler, delayMS) => globalThis.setTimeout(handler, delayMS),
  clearTimeout: (id) => globalThis.clearTimeout(id),
};

export class AnimalSoundSystem {
  private readonly timers = new Map<SoundAnimal, TimerID>();
  private readonly getPlayerPosition: () => Position;
  private readonly getSoundDelayMS: () => number;
  private readonly timerAPI: TimerAPI;

  public constructor(
    private readonly voicePlayer: VoicePlayer,
    options: AnimalSoundSystemOptions,
  ) {
    this.getPlayerPosition = options.getPlayerPosition;
    this.getSoundDelayMS = options.getSoundDelayMS ?? getRandomSoundDelayMS;
    this.timerAPI = options.timers ?? browserTimers;
  }

  public addAnimal(animal: SoundAnimal): void {
    if (animal.isDestroyed || !this.voicePlayer.hasRecording(animal)) {
      return;
    }

    this.scheduleNextSound(animal);
  }

  public updateAnimal(animal: SoundAnimal): void {
    if (animal.isDestroyed || !this.voicePlayer.hasRecording(animal)) {
      this.clearAnimalTimer(animal);
      return;
    }

    if (!this.timers.has(animal)) {
      this.scheduleNextSound(animal);
    }
  }

  public removeAnimal(animal: SoundAnimal): void {
    this.clearAnimalTimer(animal);
  }

  public destroy(): void {
    for (const timerID of this.timers.values()) {
      this.timerAPI.clearTimeout(timerID);
    }

    this.timers.clear();
  }

  private scheduleNextSound(animal: SoundAnimal): void {
    this.clearAnimalTimer(animal);

    const timerID = this.timerAPI.setTimeout(() => {
      this.timers.delete(animal);

      if (animal.isDestroyed) {
        return;
      }

      if (this.voicePlayer.hasRecording(animal)) {
        this.playScheduledSound(animal);
      }

      if (!animal.isDestroyed && this.voicePlayer.hasRecording(animal)) {
        this.scheduleNextSound(animal);
      }
    }, this.getSoundDelayMS());

    this.timers.set(animal, timerID);
  }

  private playScheduledSound(animal: SoundAnimal): void {
    const volume = calculateDistanceVolume(
      this.getPlayerPosition(),
      animal.getSoundPosition(),
      FULL_VOLUME_DISTANCE,
      MAX_SOUND_DISTANCE,
    );

    if (volume === 0) {
      return;
    }

    const didStartSound = this.voicePlayer.playRecording(animal, volume, () => {
      if (!animal.isDestroyed) {
        animal.closeMouth();
      }
    });

    if (didStartSound && !animal.isDestroyed) {
      animal.openMouth();
    }
  }

  private clearAnimalTimer(animal: SoundAnimal): void {
    const timerID = this.timers.get(animal);

    if (timerID === undefined) {
      return;
    }

    this.timerAPI.clearTimeout(timerID);
    this.timers.delete(animal);
  }
}

function getRandomSoundDelayMS(): number {
  return (
    ANIMAL_SOUND_MIN_DELAY_MS +
    Math.random() * (ANIMAL_SOUND_MAX_DELAY_MS - ANIMAL_SOUND_MIN_DELAY_MS)
  );
}
