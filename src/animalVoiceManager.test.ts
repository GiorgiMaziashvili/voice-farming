import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SoundAnimal } from "./animalSoundSystem";
import {
  AnimalVoiceManager,
  MAX_RECORDING_DURATION_MS,
} from "./animalVoiceManager";

class FakeAnimal implements SoundAnimal {
  public isDestroyed = false;
  public openMouthCalls = 0;
  public closeMouthCalls = 0;

  public getSoundPosition() {
    return { x: 0, y: 0 };
  }

  public openMouth(): void {
    this.openMouthCalls += 1;
  }

  public closeMouth(): void {
    this.closeMouthCalls += 1;
  }
}

class FakeMediaStreamTrack {
  public stop = vi.fn();
}

class FakeMediaStream {
  public readonly track = new FakeMediaStreamTrack();

  public getTracks(): FakeMediaStreamTrack[] {
    return [this.track];
  }
}

class FakeMediaRecorder {
  public static instances: FakeMediaRecorder[] = [];

  public state: RecordingState = "inactive";
  public mimeType = "audio/webm";
  public ondataavailable: ((event: BlobEvent) => void) | null = null;
  public onerror: (() => void) | null = null;
  public onstop: (() => void) | null = null;
  public readonly start = vi.fn(() => {
    this.state = "recording";
  });
  public readonly stop = vi.fn(() => {
    if (this.state !== "recording") {
      return;
    }

    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["voice"], { type: this.mimeType }),
    } as BlobEvent);
    this.onstop?.();
  });

  public constructor(public readonly stream: MediaStream) {
    FakeMediaRecorder.instances.push(this);
  }
}

class AsyncFakeMediaRecorder {
  public static instances: AsyncFakeMediaRecorder[] = [];

  public state: RecordingState = "inactive";
  public mimeType = "audio/webm";
  public ondataavailable: ((event: BlobEvent) => void) | null = null;
  public onerror: (() => void) | null = null;
  public onstop: (() => void) | null = null;
  public readonly start = vi.fn(() => {
    this.state = "recording";
  });
  public readonly stop = vi.fn(() => {
    if (this.state !== "recording") {
      return;
    }

    this.state = "inactive";
  });

  public constructor(public readonly stream: MediaStream) {
    AsyncFakeMediaRecorder.instances.push(this);
  }

  public emitData(data = "voice"): void {
    this.ondataavailable?.({
      data: new Blob([data], { type: this.mimeType }),
    } as BlobEvent);
  }

  public emitStop(): void {
    this.onstop?.();
  }
}

class FakeAudio {
  public static instances: FakeAudio[] = [];

  public volume = 1;
  public onended: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public readonly pause = vi.fn();
  public readonly play = vi.fn(() => Promise.resolve());

  public constructor(public readonly url: string) {
    FakeAudio.instances.push(this);
  }
}

class RejectingFakeAudio {
  public static instances: RejectingFakeAudio[] = [];

  public volume = 1;
  public onended: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public readonly pause = vi.fn();
  public rejectPlay: (() => void) | null = null;
  public readonly play = vi.fn(
    () =>
      new Promise<void>((_resolve, reject) => {
        this.rejectPlay = () => reject(new Error("blocked"));
      }),
  );

  public constructor(public readonly url: string) {
    RejectingFakeAudio.instances.push(this);
  }
}

const getUserMedia = vi.fn<() => Promise<MediaStream>>();
const createObjectURL = vi.fn<(blob: Blob) => string>();
const revokeObjectURL = vi.fn<(url: string) => void>();

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
} {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
}

async function recordVoice(
  manager: AnimalVoiceManager,
  animal: SoundAnimal,
): Promise<void> {
  const session = await manager.startRecording(animal, () => undefined);
  session.stop();
  await session.finished;
}

describe("animal voice manager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeMediaRecorder.instances = [];
    FakeAudio.instances = [];
    getUserMedia.mockReset();
    createObjectURL.mockReset();
    revokeObjectURL.mockReset();
    createObjectURL.mockImplementation(
      () => `blob:voice-${createObjectURL.mock.calls.length}`,
    );
    getUserMedia.mockResolvedValue(
      new FakeMediaStream() as unknown as MediaStream,
    );
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia,
      },
    });
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("stores a recording for a specific animal and plays only that animal", async () => {
    const animalWithRecording = new FakeAnimal();
    const animalWithoutRecording = new FakeAnimal();
    const manager = new AnimalVoiceManager();

    await recordVoice(manager, animalWithRecording);

    expect(manager.hasRecording(animalWithRecording)).toBe(true);
    expect(manager.hasRecording(animalWithoutRecording)).toBe(false);
    expect(manager.playRecording(animalWithoutRecording, 1)).toBe(false);
    expect(manager.playRecording(animalWithRecording, 0.25)).toBe(true);
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].url).toBe("blob:voice-1");
    expect(FakeAudio.instances[0].volume).toBe(0.25);
  });

  it("replacing a recording revokes the old URL and future playback uses the new URL", async () => {
    const animal = new FakeAnimal();
    const manager = new AnimalVoiceManager();

    await recordVoice(manager, animal);
    await recordVoice(manager, animal);

    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:voice-1");
    expect(manager.playRecording(animal, 1)).toBe(true);
    expect(FakeAudio.instances[FakeAudio.instances.length - 1].url).toBe(
      "blob:voice-2",
    );
  });

  it("deleting a recording removes only the recording and stops active playback", async () => {
    const animal = new FakeAnimal();
    const manager = new AnimalVoiceManager();

    await recordVoice(manager, animal);
    expect(manager.playRecording(animal, 1)).toBe(true);
    manager.deleteRecording(animal);

    expect(manager.hasRecording(animal)).toBe(false);
    expect(animal.isDestroyed).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:voice-1");
    expect(FakeAudio.instances[0].pause).toHaveBeenCalledTimes(1);
    expect(manager.playRecording(animal, 1)).toBe(false);
  });

  it("removing an animal cleans up its recording and active playback", async () => {
    const animal = new FakeAnimal();
    const manager = new AnimalVoiceManager();

    await recordVoice(manager, animal);
    manager.playRecording(animal, 1);
    manager.removeAnimal(animal);

    expect(manager.hasRecording(animal)).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:voice-1");
    expect(FakeAudio.instances[0].pause).toHaveBeenCalledTimes(1);
  });

  it("automatically stops recording at the 10-second limit and cleans up the stream", async () => {
    const animal = new FakeAnimal();
    const stream = new FakeMediaStream();
    getUserMedia.mockResolvedValue(stream as unknown as MediaStream);
    const elapsed: number[] = [];
    const manager = new AnimalVoiceManager();

    const session = await manager.startRecording(animal, (elapsedMS) => {
      elapsed.push(elapsedMS);
    });

    vi.advanceTimersByTime(MAX_RECORDING_DURATION_MS);
    await session.finished;
    await flushPromises();

    expect(FakeMediaRecorder.instances).toHaveLength(1);
    expect(FakeMediaRecorder.instances[0].stop).toHaveBeenCalledTimes(1);
    expect(manager.hasRecording(animal)).toBe(true);
    expect(stream.track.stop).toHaveBeenCalledTimes(1);
    expect(elapsed[elapsed.length - 1]).toBe(MAX_RECORDING_DURATION_MS);
  });

  it("cancelling a recording stops microphone tracks and does not store audio", async () => {
    const animal = new FakeAnimal();
    const stream = new FakeMediaStream();
    getUserMedia.mockResolvedValue(stream as unknown as MediaStream);
    const manager = new AnimalVoiceManager();

    const session = await manager.startRecording(animal, () => undefined);
    session.cancel();

    await expect(session.finished).rejects.toThrow("Recording was cancelled.");
    expect(stream.track.stop).toHaveBeenCalledTimes(1);
    expect(manager.hasRecording(animal)).toBe(false);
  });

  it("cancels a pending microphone request before MediaRecorder exists", async () => {
    const animal = new FakeAnimal();
    const stream = new FakeMediaStream();
    const permission = createDeferred<MediaStream>();
    getUserMedia.mockReturnValue(permission.promise);
    const manager = new AnimalVoiceManager();

    const recording = manager.startRecording(animal, () => undefined);
    await flushPromises();
    manager.cancelRecording(animal);
    permission.resolve(stream as unknown as MediaStream);

    await expect(recording).rejects.toThrow("Recording was cancelled.");
    expect(stream.track.stop).toHaveBeenCalledTimes(1);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(manager.hasRecording(animal)).toBe(false);
  });

  it("stops a resolved pending stream and does not start recording after animal removal", async () => {
    const animal = new FakeAnimal();
    const stream = new FakeMediaStream();
    const permission = createDeferred<MediaStream>();
    getUserMedia.mockReturnValue(permission.promise);
    const manager = new AnimalVoiceManager();

    const recording = manager.startRecording(animal, () => undefined);
    await flushPromises();
    manager.removeAnimal(animal);
    permission.resolve(stream as unknown as MediaStream);

    await expect(recording).rejects.toThrow("Recording was cancelled.");
    expect(stream.track.stop).toHaveBeenCalledTimes(1);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(manager.hasRecording(animal)).toBe(false);
  });

  it("stops a resolved pending stream and does not start recording after animal destruction", async () => {
    const animal = new FakeAnimal();
    const stream = new FakeMediaStream();
    const permission = createDeferred<MediaStream>();
    getUserMedia.mockReturnValue(permission.promise);
    const manager = new AnimalVoiceManager();

    const recording = manager.startRecording(animal, () => undefined);
    await flushPromises();
    animal.isDestroyed = true;
    permission.resolve(stream as unknown as MediaStream);

    await expect(recording).rejects.toThrow("Recording was cancelled.");
    expect(stream.track.stop).toHaveBeenCalledTimes(1);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(manager.hasRecording(animal)).toBe(false);
  });

  it("stops a resolved pending stream and does not start recording after manager destruction", async () => {
    const animal = new FakeAnimal();
    const stream = new FakeMediaStream();
    const permission = createDeferred<MediaStream>();
    getUserMedia.mockReturnValue(permission.promise);
    const manager = new AnimalVoiceManager();

    const recording = manager.startRecording(animal, () => undefined);
    await flushPromises();
    manager.destroy();
    permission.resolve(stream as unknown as MediaStream);

    await expect(recording).rejects.toThrow("Recording was cancelled.");
    expect(stream.track.stop).toHaveBeenCalledTimes(1);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(manager.hasRecording(animal)).toBe(false);
  });

  it("keeps only the latest pending recording tracked when a new request starts", async () => {
    const animal = new FakeAnimal();
    const firstStream = new FakeMediaStream();
    const secondStream = new FakeMediaStream();
    const firstPermission = createDeferred<MediaStream>();
    const secondPermission = createDeferred<MediaStream>();
    getUserMedia
      .mockReturnValueOnce(firstPermission.promise)
      .mockReturnValueOnce(secondPermission.promise);
    const manager = new AnimalVoiceManager();

    const firstRecording = manager.startRecording(animal, () => undefined);
    await flushPromises();
    const secondRecording = manager.startRecording(animal, () => undefined);
    await flushPromises();

    firstPermission.resolve(firstStream as unknown as MediaStream);
    await expect(firstRecording).rejects.toThrow("Recording was cancelled.");

    secondPermission.resolve(secondStream as unknown as MediaStream);
    const session = await secondRecording;
    session.stop();
    await session.finished;

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(firstStream.track.stop).toHaveBeenCalledTimes(1);
    expect(secondStream.track.stop).toHaveBeenCalledTimes(1);
    expect(FakeMediaRecorder.instances).toHaveLength(1);
    expect(FakeMediaRecorder.instances[0].stream).toBe(secondStream);
    expect(manager.hasRecording(animal)).toBe(true);
  });

  it("cancelling after stop settles inactive pending-stop recordings without storing audio", async () => {
    const animal = new FakeAnimal();
    const stream = new FakeMediaStream();
    getUserMedia.mockResolvedValue(stream as unknown as MediaStream);
    vi.stubGlobal("MediaRecorder", AsyncFakeMediaRecorder);
    AsyncFakeMediaRecorder.instances = [];
    const manager = new AnimalVoiceManager();

    const session = await manager.startRecording(animal, () => undefined);
    const recorder = AsyncFakeMediaRecorder.instances[0];
    session.stop();
    session.cancel();

    await expect(session.finished).rejects.toThrow("Recording was cancelled.");
    recorder.emitData();
    recorder.emitStop();

    expect(stream.track.stop).toHaveBeenCalledTimes(1);
    expect(manager.hasRecording(animal)).toBe(false);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("does not store pending stopped audio after the animal is destroyed", async () => {
    const animal = new FakeAnimal();
    const stream = new FakeMediaStream();
    getUserMedia.mockResolvedValue(stream as unknown as MediaStream);
    vi.stubGlobal("MediaRecorder", AsyncFakeMediaRecorder);
    AsyncFakeMediaRecorder.instances = [];
    const manager = new AnimalVoiceManager();

    const session = await manager.startRecording(animal, () => undefined);
    const recorder = AsyncFakeMediaRecorder.instances[0];
    session.stop();
    animal.isDestroyed = true;
    recorder.emitData();
    recorder.emitStop();

    await expect(session.finished).rejects.toThrow("Recording was cancelled.");
    expect(stream.track.stop).toHaveBeenCalledTimes(1);
    expect(manager.hasRecording(animal)).toBe(false);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("does not store pending stopped audio after manager destruction", async () => {
    const animal = new FakeAnimal();
    const stream = new FakeMediaStream();
    getUserMedia.mockResolvedValue(stream as unknown as MediaStream);
    vi.stubGlobal("MediaRecorder", AsyncFakeMediaRecorder);
    AsyncFakeMediaRecorder.instances = [];
    const manager = new AnimalVoiceManager();

    const session = await manager.startRecording(animal, () => undefined);
    const recorder = AsyncFakeMediaRecorder.instances[0];
    session.stop();
    manager.destroy();
    recorder.emitData();
    recorder.emitStop();

    await expect(session.finished).rejects.toThrow("Recording was cancelled.");
    expect(stream.track.stop).toHaveBeenCalledTimes(1);
    expect(manager.hasRecording(animal)).toBe(false);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("forced playback cleanup invokes finish callbacks", async () => {
    const animal = new FakeAnimal();
    const manager = new AnimalVoiceManager();
    const onFinished = vi.fn();

    await recordVoice(manager, animal);
    expect(manager.playRecording(animal, 1, onFinished)).toBe(true);
    manager.deleteRecording(animal);

    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(FakeAudio.instances[0].pause).toHaveBeenCalledTimes(1);
  });

  it("late play rejection after forced cleanup does not recreate an empty playback set", async () => {
    const animal = new FakeAnimal();
    const manager = new AnimalVoiceManager();
    const onFinished = vi.fn();

    await recordVoice(manager, animal);
    vi.stubGlobal("Audio", RejectingFakeAudio);
    RejectingFakeAudio.instances = [];
    expect(manager.playRecording(animal, 1, onFinished)).toBe(true);

    manager.deleteRecording(animal);
    RejectingFakeAudio.instances[0].rejectPlay?.();
    await flushPromises();

    const activePlaybacks = (
      manager as unknown as {
        activePlaybacks: Map<SoundAnimal, Set<unknown>>;
      }
    ).activePlaybacks;
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(activePlaybacks.has(animal)).toBe(false);
  });

  it("reports microphone permission denial without creating a recorder", async () => {
    const animal = new FakeAnimal();
    const manager = new AnimalVoiceManager();
    getUserMedia.mockRejectedValue(new Error("denied"));

    await expect(
      manager.startRecording(animal, () => undefined),
    ).rejects.toThrow("Microphone permission was denied.");
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });
});
