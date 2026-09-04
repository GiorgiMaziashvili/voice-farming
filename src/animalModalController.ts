import type { RecordingSession } from "./animalVoiceManager";
import type { SoundAnimal } from "./animalSoundSystem";

export type ModalAnimal = SoundAnimal & {
  setSelected(isSelected: boolean): void;
};

type VoiceRecorder = {
  startRecording(
    animal: ModalAnimal,
    onElapsedMS: (elapsedMS: number) => void,
  ): Promise<RecordingSession>;
  cancelRecording(animal: ModalAnimal): void;
};

type AnimalModalControllerOptions<TAnimal extends ModalAnimal> = {
  readonly voiceRecorder: VoiceRecorder;
  readonly render: () => void;
  readonly renderRecordingTime: (elapsedMS: number) => void;
  readonly getErrorMessage: (error: unknown) => string;
  readonly onRecordingFinished: (animal: TAnimal) => void;
};

export class AnimalModalController<TAnimal extends ModalAnimal = ModalAnimal> {
  public selectedAnimal: TAnimal | null = null;
  public recordingPendingAnimal: TAnimal | null = null;
  public recordingAnimal: TAnimal | null = null;
  public modalError = "";
  private recordingSession: RecordingSession | null = null;
  private readonly voiceRecorder: VoiceRecorder;
  private readonly render: () => void;
  private readonly renderRecordingTime: (elapsedMS: number) => void;
  private readonly getErrorMessage: (error: unknown) => string;
  private readonly onRecordingFinished: (animal: TAnimal) => void;

  public constructor(options: AnimalModalControllerOptions<TAnimal>) {
    this.voiceRecorder = options.voiceRecorder;
    this.render = options.render;
    this.renderRecordingTime = options.renderRecordingTime;
    this.getErrorMessage = options.getErrorMessage;
    this.onRecordingFinished = options.onRecordingFinished;
  }

  public selectAnimal(animal: TAnimal | null): void {
    if (this.selectedAnimal === animal) {
      if (animal) {
        this.render();
      }

      return;
    }

    if (this.selectedAnimal) {
      this.cancelRecordingForAnimal(this.selectedAnimal);
    }

    this.selectedAnimal?.setSelected(false);
    this.selectedAnimal = animal;
    this.selectedAnimal?.setSelected(true);
    this.modalError = "";
    this.render();
  }

  public cancelRecordingForAnimal(animal: TAnimal): void {
    if (this.recordingPendingAnimal === animal) {
      this.recordingPendingAnimal = null;
      this.voiceRecorder.cancelRecording(animal);
    }

    if (this.recordingAnimal === animal) {
      const session = this.recordingSession;

      this.recordingAnimal = null;
      this.recordingSession = null;
      session?.cancel();
    }
  }

  public async startRecordingForSelectedAnimal(): Promise<void> {
    const animal = this.selectedAnimal;

    if (!animal) {
      return;
    }

    if (this.recordingPendingAnimal || this.recordingAnimal) {
      return;
    }

    this.modalError = "";
    this.recordingPendingAnimal = animal;
    this.render();

    try {
      const session = await this.voiceRecorder.startRecording(
        animal,
        (elapsedMS) => {
          if (this.recordingAnimal === animal) {
            this.renderRecordingTime(elapsedMS);
          }
        },
      );

      if (this.recordingPendingAnimal !== animal) {
        session.cancel();
        return;
      }

      this.recordingSession = session;
      this.recordingPendingAnimal = null;
      this.recordingAnimal = animal;
      this.renderRecordingTime(0);
      this.render();

      void session.finished
        .then(() => {
          if (this.recordingAnimal === animal) {
            this.recordingAnimal = null;
            this.recordingSession = null;
          }

          this.onRecordingFinished(animal);

          if (this.selectedAnimal === animal) {
            this.modalError = "";
            this.render();
          }
        })
        .catch((error: unknown) => {
          if (this.recordingAnimal === animal) {
            this.recordingAnimal = null;
            this.recordingSession = null;
          }

          if (this.selectedAnimal === animal) {
            this.modalError = this.getErrorMessage(error);
            this.render();
          }
        });
    } catch (error) {
      if (this.recordingPendingAnimal === animal) {
        this.recordingPendingAnimal = null;
      }

      if (this.selectedAnimal === animal) {
        this.modalError = this.getErrorMessage(error);
        this.render();
      }
    }
  }

  public stopRecording(): void {
    this.recordingSession?.stop();
  }
}
