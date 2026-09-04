import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnimalSoundSystem,
  SoundAnimal,
  VoicePlayer,
} from "./animalSoundSystem";

class FakeAnimal implements SoundAnimal {
  public isDestroyed = false;
  public openMouthCalls = 0;
  public closeMouthCalls = 0;
  public position = { x: 0, y: 0 };

  public getSoundPosition() {
    return this.position;
  }

  public openMouth(): void {
    this.openMouthCalls += 1;
  }

  public closeMouth(): void {
    this.closeMouthCalls += 1;
  }
}

class FakeVoicePlayer implements VoicePlayer {
  public playRecordingCalls = 0;
  public lastVolume = 0;
  public lastOnFinished: (() => void) | undefined;
  public playedAnimals: SoundAnimal[] = [];
  private readonly recordings = new Set<SoundAnimal>();

  public addRecording(animal: SoundAnimal): void {
    this.recordings.add(animal);
  }

  public deleteRecording(animal: SoundAnimal): void {
    this.recordings.delete(animal);
  }

  public hasRecording(animal: SoundAnimal): boolean {
    return this.recordings.has(animal);
  }

  public playRecording(
    animal: SoundAnimal,
    volume: number,
    onFinished?: () => void,
  ): boolean {
    this.playRecordingCalls += 1;
    this.lastVolume = volume;
    this.lastOnFinished = onFinished;
    this.playedAnimals.push(animal);

    return true;
  }
}

describe("animal sound system", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cleans up scheduled sound timers", () => {
    const animal = new FakeAnimal();
    const voicePlayer = new FakeVoicePlayer();
    voicePlayer.addRecording(animal);
    const system = new AnimalSoundSystem(voicePlayer, {
      getPlayerPosition: () => ({ x: 0, y: 0 }),
      getSoundDelayMS: () => 1000,
    });

    system.addAnimal(animal);
    system.destroy();
    vi.advanceTimersByTime(1000);

    expect(voicePlayer.playRecordingCalls).toBe(0);
    expect(animal.openMouthCalls).toBe(0);
  });

  it("does not schedule or play sound for an animal without a recording", () => {
    const animal = new FakeAnimal();
    const voicePlayer = new FakeVoicePlayer();
    const system = new AnimalSoundSystem(voicePlayer, {
      getPlayerPosition: () => ({ x: 0, y: 0 }),
      getSoundDelayMS: () => 1000,
    });

    system.addAnimal(animal);
    vi.advanceTimersByTime(5000);

    expect(voicePlayer.playRecordingCalls).toBe(0);
    expect(animal.openMouthCalls).toBe(0);
    system.destroy();
  });

  it("starts scheduling when a recording is added", () => {
    const animal = new FakeAnimal();
    const voicePlayer = new FakeVoicePlayer();
    const system = new AnimalSoundSystem(voicePlayer, {
      getPlayerPosition: () => ({ x: 0, y: 0 }),
      getSoundDelayMS: () => 1000,
    });

    system.addAnimal(animal);
    voicePlayer.addRecording(animal);
    system.updateAnimal(animal);
    vi.advanceTimersByTime(1000);

    expect(voicePlayer.playRecordingCalls).toBe(1);
    expect(voicePlayer.playedAnimals).toEqual([animal]);
    expect(animal.openMouthCalls).toBe(1);
    system.destroy();
  });

  it("stops scheduling when a recording is deleted", () => {
    const animal = new FakeAnimal();
    const voicePlayer = new FakeVoicePlayer();
    voicePlayer.addRecording(animal);
    const system = new AnimalSoundSystem(voicePlayer, {
      getPlayerPosition: () => ({ x: 0, y: 0 }),
      getSoundDelayMS: () => 1000,
    });

    system.addAnimal(animal);
    voicePlayer.deleteRecording(animal);
    system.updateAnimal(animal);
    vi.advanceTimersByTime(1000);

    expect(voicePlayer.playRecordingCalls).toBe(0);
    expect(animal.openMouthCalls).toBe(0);
    system.destroy();
  });

  it("uses the current animal position when calculating playback volume", () => {
    const animal = new FakeAnimal();
    const voicePlayer = new FakeVoicePlayer();
    voicePlayer.addRecording(animal);
    const system = new AnimalSoundSystem(voicePlayer, {
      getPlayerPosition: () => ({ x: 0, y: 0 }),
      getSoundDelayMS: () => 1000,
    });

    system.addAnimal(animal);
    animal.position = { x: 300, y: 0 };
    vi.advanceTimersByTime(1000);

    expect(voicePlayer.playRecordingCalls).toBe(1);
    expect(voicePlayer.lastVolume).toBeCloseTo(0.5);
    system.destroy();
  });

  it("skips playback at zero volume but schedules the next attempt", () => {
    const animal = new FakeAnimal();
    animal.position = { x: 500, y: 0 };
    const voicePlayer = new FakeVoicePlayer();
    voicePlayer.addRecording(animal);
    const system = new AnimalSoundSystem(voicePlayer, {
      getPlayerPosition: () => ({ x: 0, y: 0 }),
      getSoundDelayMS: () => 1000,
    });

    system.addAnimal(animal);
    vi.advanceTimersByTime(1000);
    expect(voicePlayer.playRecordingCalls).toBe(0);

    animal.position = { x: 0, y: 0 };
    vi.advanceTimersByTime(1000);

    expect(voicePlayer.playRecordingCalls).toBe(1);
    expect(animal.openMouthCalls).toBe(1);
    system.destroy();
  });

  it("does not mutate a destroyed animal from a delayed mouth callback", () => {
    const animal = new FakeAnimal();
    const voicePlayer = new FakeVoicePlayer();
    voicePlayer.addRecording(animal);
    const system = new AnimalSoundSystem(voicePlayer, {
      getPlayerPosition: () => ({ x: 0, y: 0 }),
      getSoundDelayMS: () => 1000,
    });

    system.addAnimal(animal);
    vi.advanceTimersByTime(1000);
    animal.isDestroyed = true;
    voicePlayer.lastOnFinished?.();

    expect(voicePlayer.playRecordingCalls).toBe(1);
    expect(animal.openMouthCalls).toBe(1);
    expect(animal.closeMouthCalls).toBe(0);
    system.destroy();
  });

  it("removes one animal without affecting other scheduled animal sounds", () => {
    const removedAnimal = new FakeAnimal();
    const activeAnimal = new FakeAnimal();
    const voicePlayer = new FakeVoicePlayer();
    voicePlayer.addRecording(removedAnimal);
    voicePlayer.addRecording(activeAnimal);
    const system = new AnimalSoundSystem(voicePlayer, {
      getPlayerPosition: () => ({ x: 0, y: 0 }),
      getSoundDelayMS: () => 1000,
    });

    system.addAnimal(removedAnimal);
    system.addAnimal(activeAnimal);
    system.removeAnimal(removedAnimal);
    vi.advanceTimersByTime(1000);

    expect(voicePlayer.playRecordingCalls).toBe(1);
    expect(voicePlayer.playedAnimals).toEqual([activeAnimal]);
    expect(removedAnimal.openMouthCalls).toBe(0);
    expect(removedAnimal.closeMouthCalls).toBe(0);
    expect(activeAnimal.openMouthCalls).toBe(1);
    system.destroy();
  });

  it("cancels future sounds and ignores delayed callbacks after removing a destroyed animal", () => {
    const animal = new FakeAnimal();
    const voicePlayer = new FakeVoicePlayer();
    voicePlayer.addRecording(animal);
    const system = new AnimalSoundSystem(voicePlayer, {
      getPlayerPosition: () => ({ x: 0, y: 0 }),
      getSoundDelayMS: () => 1000,
    });

    system.addAnimal(animal);
    vi.advanceTimersByTime(1000);

    system.removeAnimal(animal);
    animal.isDestroyed = true;
    voicePlayer.lastOnFinished?.();
    vi.advanceTimersByTime(1000);

    expect(voicePlayer.playRecordingCalls).toBe(1);
    expect(voicePlayer.playedAnimals).toEqual([animal]);
    expect(animal.openMouthCalls).toBe(1);
    expect(animal.closeMouthCalls).toBe(0);
    system.destroy();
  });
});
