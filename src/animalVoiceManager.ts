import { SoundAnimal, VoicePlayer } from "./animalSoundSystem";

export type RecordingSession = {
  readonly finished: Promise<void>;
  stop(): void;
  cancel(): void;
};

type StoredRecording = {
  readonly blob: Blob;
  readonly url: string;
};

type ActivePlayback = {
  readonly audio: HTMLAudioElement;
  cleanup(shouldFinish: boolean): void;
};

type PendingRecording = {
  readonly animal: SoundAnimal;
  cancelled: boolean;
};

type ActiveRecording = {
  readonly animal: SoundAnimal;
  readonly recorder: MediaRecorder;
  readonly stream: MediaStream;
  readonly chunks: Blob[];
  readonly elapsedTimer: ReturnType<typeof setInterval>;
  readonly maxTimer: ReturnType<typeof setTimeout>;
  cancel: () => void;
  cancelled: boolean;
  settled: boolean;
};

export const MAX_RECORDING_DURATION_MS = 10_000;

export class AnimalVoiceManager implements VoicePlayer {
  private readonly recordings = new Map<SoundAnimal, StoredRecording>();
  private readonly activePlaybacks = new Map<
    SoundAnimal,
    Set<ActivePlayback>
  >();
  private pendingRecording: PendingRecording | null = null;
  private activeRecording: ActiveRecording | null = null;
  private isDestroyed = false;

  public hasRecording(animal: SoundAnimal): boolean {
    return this.recordings.has(animal);
  }

  public async startRecording(
    animal: SoundAnimal,
    onElapsedMS: (elapsedMS: number) => void,
  ): Promise<RecordingSession> {
    if (this.isDestroyed) {
      throw new Error("Cannot record after voice manager was destroyed.");
    }

    if (animal.isDestroyed) {
      throw new Error("Cannot record for a removed animal.");
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone recording is not supported in this browser.");
    }

    if (typeof MediaRecorder === "undefined") {
      throw new Error("MediaRecorder is not available in this browser.");
    }

    this.cancelRecording();

    const pendingRecording: PendingRecording = {
      animal,
      cancelled: false,
    };
    this.pendingRecording = pendingRecording;

    let stream: MediaStream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      if (this.pendingRecording === pendingRecording) {
        this.pendingRecording = null;
      }

      if (
        pendingRecording.cancelled ||
        this.isDestroyed ||
        animal.isDestroyed
      ) {
        throw new Error("Recording was cancelled.");
      }

      throw new Error("Microphone permission was denied.");
    }

    if (
      this.pendingRecording !== pendingRecording ||
      pendingRecording.cancelled ||
      this.isDestroyed ||
      animal.isDestroyed
    ) {
      stopStream(stream);
      throw new Error("Recording was cancelled.");
    }

    this.pendingRecording = null;

    let recorder: MediaRecorder;

    try {
      recorder = new MediaRecorder(stream);
    } catch {
      stopStream(stream);
      throw new Error("Could not start microphone recording.");
    }

    let finishSession: () => void = () => undefined;
    let failSession: (error: Error) => void = () => undefined;

    const finished = new Promise<void>((resolve, reject) => {
      finishSession = resolve;
      failSession = reject;
    });
    const startedAt = performance.now();
    const elapsedTimer = setInterval(() => {
      onElapsedMS(
        Math.min(performance.now() - startedAt, MAX_RECORDING_DURATION_MS),
      );
    }, 100);
    const maxTimer = setTimeout(() => {
      if (recorder.state === "recording") {
        recorder.stop();
      }
    }, MAX_RECORDING_DURATION_MS);
    const activeRecording: ActiveRecording = {
      animal,
      recorder,
      stream,
      chunks: [],
      elapsedTimer,
      maxTimer,
      cancel: () => undefined,
      cancelled: false,
      settled: false,
    };

    const cleanupRecording = (): void => {
      clearInterval(activeRecording.elapsedTimer);
      clearTimeout(activeRecording.maxTimer);
      stopStream(activeRecording.stream);
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;

      if (this.activeRecording === activeRecording) {
        this.activeRecording = null;
      }
    };
    const cancelRecording = (): void => {
      if (activeRecording.settled) {
        return;
      }

      activeRecording.cancelled = true;

      if (recorder.state === "recording") {
        recorder.stop();
        return;
      }

      activeRecording.settled = true;
      cleanupRecording();
      failSession(new Error("Recording was cancelled."));
    };

    activeRecording.cancel = cancelRecording;

    recorder.ondataavailable = (event: BlobEvent): void => {
      if (event.data.size > 0) {
        activeRecording.chunks.push(event.data);
      }
    };
    recorder.onerror = (): void => {
      if (activeRecording.settled) {
        return;
      }

      activeRecording.cancelled = true;
      activeRecording.settled = true;
      cleanupRecording();
      failSession(new Error("Recording failed."));
    };
    recorder.onstop = (): void => {
      if (activeRecording.settled) {
        return;
      }

      activeRecording.settled = true;
      cleanupRecording();

      if (activeRecording.cancelled || this.isDestroyed || animal.isDestroyed) {
        failSession(new Error("Recording was cancelled."));
        return;
      }

      if (activeRecording.chunks.length === 0) {
        failSession(new Error("No audio was recorded."));
        return;
      }

      const mimeType = recorder.mimeType || "audio/webm";
      const blob = new Blob(activeRecording.chunks, { type: mimeType });
      this.setRecording(animal, blob);
      finishSession();
    };

    this.activeRecording = activeRecording;

    try {
      recorder.start();
    } catch {
      activeRecording.cancelled = true;
      activeRecording.settled = true;
      cleanupRecording();
      failSession(new Error("Could not start microphone recording."));
    }

    return {
      finished,
      stop: () => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      },
      cancel: () => {
        if (this.activeRecording !== activeRecording) {
          return;
        }

        cancelRecording();
      },
    };
  }

  public cancelRecording(animal?: SoundAnimal): void {
    const pendingRecording = this.pendingRecording;

    if (pendingRecording && (!animal || pendingRecording.animal === animal)) {
      pendingRecording.cancelled = true;
      this.pendingRecording = null;
    }

    const activeRecording = this.activeRecording;

    if (!activeRecording || (animal && activeRecording.animal !== animal)) {
      return;
    }

    activeRecording.cancelled = true;
    activeRecording.cancel();
  }

  public playRecording(
    animal: SoundAnimal,
    volume: number,
    onFinished?: () => void,
  ): boolean {
    const recording = this.recordings.get(animal);

    if (!recording || volume <= 0 || animal.isDestroyed) {
      return false;
    }

    const audio = new Audio(recording.url);
    audio.volume = Math.max(0, Math.min(volume, 1));
    let isCleanedUp = false;

    const activePlayback: ActivePlayback = {
      audio,
      cleanup: (shouldFinish: boolean) => {
        if (isCleanedUp) {
          return;
        }

        isCleanedUp = true;
        audio.pause();
        audio.onended = null;
        audio.onerror = null;
        const playbackSet = this.activePlaybacks.get(animal);

        if (playbackSet) {
          playbackSet.delete(activePlayback);

          if (playbackSet.size === 0) {
            this.activePlaybacks.delete(animal);
          }
        }

        if (shouldFinish) {
          onFinished?.();
        }
      },
    };

    getOrCreatePlaybackSet(this.activePlaybacks, animal).add(activePlayback);

    audio.onended = (): void => {
      activePlayback.cleanup(true);
    };
    audio.onerror = (): void => {
      activePlayback.cleanup(true);
    };
    void audio.play().catch(() => {
      activePlayback.cleanup(true);
    });

    return true;
  }

  public previewRecording(
    animal: SoundAnimal,
    onFinished?: () => void,
  ): boolean {
    return this.playRecording(animal, 1, onFinished);
  }

  public deleteRecording(animal: SoundAnimal): void {
    this.cancelRecording(animal);
    this.stopPlayback(animal);

    const recording = this.recordings.get(animal);

    if (!recording) {
      return;
    }

    URL.revokeObjectURL(recording.url);
    this.recordings.delete(animal);
  }

  public removeAnimal(animal: SoundAnimal): void {
    this.deleteRecording(animal);
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.cancelRecording();

    for (const animal of this.activePlaybacks.keys()) {
      this.stopPlayback(animal);
    }

    for (const recording of this.recordings.values()) {
      URL.revokeObjectURL(recording.url);
    }

    this.recordings.clear();
  }

  private setRecording(animal: SoundAnimal, blob: Blob): void {
    if (this.isDestroyed || animal.isDestroyed) {
      return;
    }

    this.deleteRecording(animal);
    this.recordings.set(animal, {
      blob,
      url: URL.createObjectURL(blob),
    });
  }

  private stopPlayback(animal: SoundAnimal): void {
    const playbacks = this.activePlaybacks.get(animal);

    if (!playbacks) {
      return;
    }

    for (const playback of Array.from(playbacks)) {
      playback.cleanup(true);
    }

    this.activePlaybacks.delete(animal);
  }
}

function getOrCreatePlaybackSet(
  playbacks: Map<SoundAnimal, Set<ActivePlayback>>,
  animal: SoundAnimal,
): Set<ActivePlayback> {
  let playbackSet = playbacks.get(animal);

  if (!playbackSet) {
    playbackSet = new Set<ActivePlayback>();
    playbacks.set(animal, playbackSet);
  }

  return playbackSet;
}

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}
