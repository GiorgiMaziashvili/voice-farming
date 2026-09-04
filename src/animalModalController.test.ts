import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnimalModalController } from "./animalModalController";
import type { ModalAnimal } from "./animalModalController";
import type { RecordingSession } from "./animalVoiceManager";

class FakeAnimal implements ModalAnimal {
  public isDestroyed = false;
  public selectedStates: boolean[] = [];
  public openMouth = vi.fn();
  public closeMouth = vi.fn();

  public getSoundPosition() {
    return { x: 0, y: 0 };
  }

  public setSelected(isSelected: boolean): void {
    this.selectedStates.push(isSelected);
  }
}

class FakeRecordingSession implements RecordingSession {
  public readonly stop = vi.fn();
  public readonly cancel = vi.fn();
  public readonly finished: Promise<void>;
  public finish: () => void = () => undefined;
  public fail: (error: unknown) => void = () => undefined;

  public constructor() {
    this.finished = new Promise((resolve, reject) => {
      this.finish = resolve;
      this.fail = reject;
    });
  }
}

class FakeVoiceRecorder {
  public readonly startRecording =
    vi.fn<
      (
        animal: ModalAnimal,
        onElapsedMS: (elapsedMS: number) => void,
      ) => Promise<RecordingSession>
    >();
  public readonly cancelRecording = vi.fn<(animal: ModalAnimal) => void>();
}

type Deferred<T> = {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
};

function createDeferred<T>(): Deferred<T> {
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

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function createController(voiceRecorder = new FakeVoiceRecorder()): {
  readonly controller: AnimalModalController;
  readonly voiceRecorder: FakeVoiceRecorder;
  readonly render: ReturnType<typeof vi.fn>;
  readonly renderRecordingTime: ReturnType<typeof vi.fn>;
  readonly onRecordingFinished: ReturnType<typeof vi.fn>;
} {
  const render = vi.fn();
  const renderRecordingTime = vi.fn();
  const onRecordingFinished = vi.fn();
  const controller = new AnimalModalController({
    voiceRecorder,
    render,
    renderRecordingTime,
    getErrorMessage: (error) =>
      error instanceof Error ? error.message : "Recording failed.",
    onRecordingFinished,
  });

  return {
    controller,
    voiceRecorder,
    render,
    renderRecordingTime,
    onRecordingFinished,
  };
}

describe("animal modal controller", () => {
  let unhandledRejections: unknown[];

  beforeEach(() => {
    unhandledRejections = [];
  });

  it("cancels pending permission when modal dismissal selects no animal", async () => {
    const animal = new FakeAnimal();
    const pendingStart = createDeferred<RecordingSession>();
    const voiceRecorder = new FakeVoiceRecorder();
    voiceRecorder.startRecording.mockReturnValue(pendingStart.promise);
    const { controller } = createController(voiceRecorder);

    controller.selectAnimal(animal);
    void controller
      .startRecordingForSelectedAnimal()
      .catch((error: unknown) => {
        unhandledRejections.push(error);
      });
    await flushPromises();

    controller.selectAnimal(null);

    expect(controller.selectedAnimal).toBeNull();
    expect(controller.recordingPendingAnimal).toBeNull();
    expect(voiceRecorder.cancelRecording).toHaveBeenCalledTimes(1);
    expect(voiceRecorder.cancelRecording).toHaveBeenCalledWith(animal);
    expect(animal.selectedStates).toEqual([true, false]);
    expect(unhandledRejections).toEqual([]);
  });

  it("cancels active recording when modal dismissal selects no animal", async () => {
    const animal = new FakeAnimal();
    const session = new FakeRecordingSession();
    const voiceRecorder = new FakeVoiceRecorder();
    voiceRecorder.startRecording.mockResolvedValue(session);
    const { controller } = createController(voiceRecorder);

    controller.selectAnimal(animal);
    await controller.startRecordingForSelectedAnimal();

    controller.selectAnimal(null);

    expect(controller.selectedAnimal).toBeNull();
    expect(controller.recordingAnimal).toBeNull();
    expect(session.cancel).toHaveBeenCalledTimes(1);
    expect(voiceRecorder.cancelRecording).not.toHaveBeenCalled();
    expect(animal.selectedStates).toEqual([true, false]);
  });

  it("selecting another animal cancels pending permission for the prior animal", async () => {
    const firstAnimal = new FakeAnimal();
    const secondAnimal = new FakeAnimal();
    const pendingStart = createDeferred<RecordingSession>();
    const voiceRecorder = new FakeVoiceRecorder();
    voiceRecorder.startRecording.mockReturnValue(pendingStart.promise);
    const { controller } = createController(voiceRecorder);

    controller.selectAnimal(firstAnimal);
    void controller
      .startRecordingForSelectedAnimal()
      .catch((error: unknown) => {
        unhandledRejections.push(error);
      });
    await flushPromises();

    controller.selectAnimal(secondAnimal);

    expect(controller.selectedAnimal).toBe(secondAnimal);
    expect(controller.recordingPendingAnimal).toBeNull();
    expect(voiceRecorder.cancelRecording).toHaveBeenCalledTimes(1);
    expect(voiceRecorder.cancelRecording).toHaveBeenCalledWith(firstAnimal);
    expect(firstAnimal.selectedStates).toEqual([true, false]);
    expect(secondAnimal.selectedStates).toEqual([true]);
    expect(unhandledRejections).toEqual([]);
  });

  it("selecting another animal cancels active recording for the prior animal", async () => {
    const firstAnimal = new FakeAnimal();
    const secondAnimal = new FakeAnimal();
    const session = new FakeRecordingSession();
    const voiceRecorder = new FakeVoiceRecorder();
    voiceRecorder.startRecording.mockResolvedValue(session);
    const { controller } = createController(voiceRecorder);

    controller.selectAnimal(firstAnimal);
    await controller.startRecordingForSelectedAnimal();
    controller.selectAnimal(secondAnimal);

    expect(controller.selectedAnimal).toBe(secondAnimal);
    expect(controller.recordingAnimal).toBeNull();
    expect(session.cancel).toHaveBeenCalledTimes(1);
    expect(firstAnimal.selectedStates).toEqual([true, false]);
    expect(secondAnimal.selectedStates).toEqual([true]);
  });

  it("close/remove style repeated cancellation does not double-cancel pending permission", async () => {
    const animal = new FakeAnimal();
    const pendingStart = createDeferred<RecordingSession>();
    const voiceRecorder = new FakeVoiceRecorder();
    voiceRecorder.startRecording.mockReturnValue(pendingStart.promise);
    const { controller } = createController(voiceRecorder);

    controller.selectAnimal(animal);
    void controller
      .startRecordingForSelectedAnimal()
      .catch((error: unknown) => {
        unhandledRejections.push(error);
      });
    await flushPromises();

    controller.cancelRecordingForAnimal(animal);
    controller.selectAnimal(null);

    expect(voiceRecorder.cancelRecording).toHaveBeenCalledTimes(1);
    expect(controller.recordingPendingAnimal).toBeNull();
    expect(unhandledRejections).toEqual([]);
  });

  it("close/remove style repeated cancellation does not double-cancel active recording", async () => {
    const animal = new FakeAnimal();
    const session = new FakeRecordingSession();
    const voiceRecorder = new FakeVoiceRecorder();
    voiceRecorder.startRecording.mockResolvedValue(session);
    const { controller } = createController(voiceRecorder);

    controller.selectAnimal(animal);
    await controller.startRecordingForSelectedAnimal();

    controller.cancelRecordingForAnimal(animal);
    controller.selectAnimal(null);

    expect(session.cancel).toHaveBeenCalledTimes(1);
    expect(controller.recordingAnimal).toBeNull();
  });

  it("stale async failure for a prior animal does not clear newer active recording state", async () => {
    const firstAnimal = new FakeAnimal();
    const secondAnimal = new FakeAnimal();
    const firstStart = createDeferred<RecordingSession>();
    const secondSession = new FakeRecordingSession();
    const voiceRecorder = new FakeVoiceRecorder();
    voiceRecorder.startRecording
      .mockReturnValueOnce(firstStart.promise)
      .mockResolvedValueOnce(secondSession);
    const { controller } = createController(voiceRecorder);

    controller.selectAnimal(firstAnimal);
    const firstRecording = controller.startRecordingForSelectedAnimal();
    await flushPromises();

    controller.selectAnimal(secondAnimal);
    await controller.startRecordingForSelectedAnimal();
    firstStart.reject(new Error("Recording was cancelled."));
    await firstRecording;
    await flushPromises();

    expect(controller.selectedAnimal).toBe(secondAnimal);
    expect(controller.recordingAnimal).toBe(secondAnimal);
    expect(controller.recordingPendingAnimal).toBeNull();
    expect(controller.modalError).toBe("");
  });
});
