import {
  Application,
  Container,
  FederatedPointerEvent,
  Graphics,
  Rectangle,
  Text,
  Ticker,
} from "pixi.js";
import {
  Direction,
  ANIMAL_FOOTPRINT_HEIGHT,
  ANIMAL_FOOTPRINT_WIDTH,
  ANIMAL_SIZE,
  PLAYER_SIZE,
  Position,
  calculateAnimalPlacementPosition,
  getMovementDirection,
  isMovementKey,
  updatePlayerPosition,
} from "./gameLogic";
import { AnimalSoundSystem } from "./animalSoundSystem";
import {
  AnimalVoiceManager,
  MAX_RECORDING_DURATION_MS,
} from "./animalVoiceManager";
import { AnimalWanderingSystem } from "./animalWanderingSystem";
import { AnimalModalController } from "./animalModalController";
import { AnimalAnimationController } from "./animalAnimationController";
import { AnimalType, isAnimalType } from "./animalTypes";
import { createAnimalSpine, loadAnimalSpineAssets } from "./animalSpineAssets";

const GAME_WIDTH = 960;
const GAME_HEIGHT = 640;
const ANIMAL_SPINE_X = ANIMAL_SIZE / 2;
const ANIMAL_SPINE_Y = ANIMAL_FOOTPRINT_HEIGHT - 18;

class KeyboardInput {
  private readonly pressedKeys = new Set<string>();

  public constructor() {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
  }

  public getDirection(): Direction {
    return getMovementDirection(this.pressedKeys);
  }

  public destroy(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!isMovementKey(event.key)) {
      return;
    }

    event.preventDefault();
    this.pressedKeys.add(event.key.toLowerCase());
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.key.toLowerCase());
  };

  private readonly handleBlur = (): void => {
    this.pressedKeys.clear();
  };
}

class Animal {
  public readonly view: Container;
  public readonly type: AnimalType;
  private readonly animation: AnimalAnimationController;
  private isMouthOpen = false;
  private destroyed = false;

  public constructor(type: AnimalType, x: number, y: number, ticker: Ticker) {
    this.type = type;
    this.view = new Container();
    this.view.eventMode = "static";
    this.view.cursor = "pointer";
    this.view.hitArea = new Rectangle(
      -(ANIMAL_FOOTPRINT_WIDTH - ANIMAL_SIZE) / 2,
      0,
      ANIMAL_FOOTPRINT_WIDTH,
      ANIMAL_FOOTPRINT_HEIGHT,
    );

    const spine = createAnimalSpine(type, ticker);
    spine.position.set(ANIMAL_SPINE_X, ANIMAL_SPINE_Y);

    const label = new Text({
      text: type,
      style: {
        fill: 0x1f2a1f,
        fontFamily: "Arial",
        fontSize: 13,
        fontWeight: "700",
      },
    });
    label.anchor.set(0.5, 0);
    label.position.set(ANIMAL_SIZE / 2, ANIMAL_FOOTPRINT_HEIGHT - 16);

    this.view.addChild(spine, label);
    this.view.position.set(x, y);
    this.animation = new AnimalAnimationController(spine);
  }

  public get isDestroyed(): boolean {
    return this.destroyed;
  }

  public destroy(): void {
    this.closeMouth();
    this.destroyed = true;
    this.animation.destroy();
    this.view.destroy({ children: true });
  }

  public setSelected(isSelected: boolean): void {
    if (this.destroyed) {
      return;
    }

    this.animation.setSelected(isSelected);
  }

  public getSoundPosition(): Position {
    return {
      x: this.view.x + ANIMAL_SIZE / 2,
      y: this.view.y + ANIMAL_SIZE / 2,
    };
  }

  public getWanderPosition(): Position {
    return {
      x: this.view.x,
      y: this.view.y,
    };
  }

  public setWanderPosition(position: Position): void {
    if (this.destroyed) {
      return;
    }

    this.view.position.set(position.x, position.y);
  }

  public setWanderMotion(isMoving: boolean, direction: Direction): void {
    if (this.destroyed) {
      return;
    }

    this.animation.setLocomotion(isMoving ? "walk" : "idle");
    this.animation.setFacingDirection(direction.x);
  }

  public openMouth(): void {
    if (this.destroyed || this.isMouthOpen) {
      return;
    }

    this.animation.startVoice();
    this.isMouthOpen = true;
  }

  public closeMouth(): void {
    if (this.destroyed) {
      return;
    }

    this.animation.stopVoice();
    this.isMouthOpen = false;
  }
}

class Player {
  public readonly view: Graphics;

  public constructor(x: number, y: number) {
    this.view = new Graphics()
      .rect(0, 0, PLAYER_SIZE, PLAYER_SIZE)
      .fill(0x2f5f38)
      .stroke({ width: 3, color: 0xf7f0d5 });

    this.view.position.set(x, y);
  }

  public update(
    direction: Direction,
    deltaMS: number,
    bounds: Rectangle,
  ): void {
    const position = updatePlayerPosition(
      this.view,
      direction,
      deltaMS,
      bounds,
    );

    this.view.position.set(position.x, position.y);
  }
}

function createFarmScene(): Container {
  const scene = new Container();

  const ground = new Graphics()
    .rect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    .fill(0x7abf5a)
    .stroke({ width: 8, color: 0x4f7f38 });
  ground.label = "farm-ground";
  ground.eventMode = "static";
  ground.cursor = "crosshair";
  ground.hitArea = new Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT);

  scene.addChild(ground);

  return scene;
}

function getRequiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }

  return element as T;
}

function createAnimalAt(
  type: AnimalType,
  x: number,
  y: number,
  ticker: Ticker,
): Animal {
  const position = calculateAnimalPlacementPosition(
    { x, y },
    { x: 0, y: 0, width: GAME_WIDTH, height: GAME_HEIGHT },
  );

  return new Animal(type, position.x, position.y, ticker);
}

function centerScene(scene: Container, app: Application): void {
  scene.position.set(
    Math.round((app.screen.width - GAME_WIDTH) / 2),
    Math.round((app.screen.height - GAME_HEIGHT) / 2),
  );
}

(async () => {
  const app = new Application();

  await app.init({
    background: 0x1f2a1f,
    resizeTo: window,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio,
  });

  getRequiredElement<HTMLDivElement>("pixi-container").appendChild(app.canvas);

  try {
    await loadAnimalSpineAssets();
  } catch (error) {
    console.error("Failed to load animal Spine assets.", error);
    app.destroy({ removeView: true, releaseGlobalResources: true });
    return;
  }

  const farmScene = createFarmScene();
  const animalLayer = new Container();
  const input = new KeyboardInput();
  const animalVoiceManager = new AnimalVoiceManager();
  const animals: Animal[] = [];
  const player = new Player(
    (GAME_WIDTH - PLAYER_SIZE) / 2,
    (GAME_HEIGHT - PLAYER_SIZE) / 2,
  );
  const gameBounds = new Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT);
  const ground = farmScene.getChildByLabel("farm-ground") as Graphics;
  const addAnimalButton =
    getRequiredElement<HTMLButtonElement>("add-animal-button");
  const animalPopup = getRequiredElement<HTMLDivElement>("animal-popup");
  const animalModal = getRequiredElement<HTMLDivElement>("animal-modal");
  const animalModalTitle =
    getRequiredElement<HTMLHeadingElement>("animal-modal-title");
  const animalVoiceStatus = getRequiredElement<HTMLParagraphElement>(
    "animal-voice-status",
  );
  const animalRecordingTime = getRequiredElement<HTMLParagraphElement>(
    "animal-recording-time",
  );
  const recordVoiceButton = getRequiredElement<HTMLButtonElement>(
    "record-voice-button",
  );
  const stopRecordingButton = getRequiredElement<HTMLButtonElement>(
    "stop-recording-button",
  );
  const previewVoiceButton = getRequiredElement<HTMLButtonElement>(
    "preview-voice-button",
  );
  const rerecordVoiceButton = getRequiredElement<HTMLButtonElement>(
    "rerecord-voice-button",
  );
  const deleteRecordingButton = getRequiredElement<HTMLButtonElement>(
    "delete-recording-button",
  );
  const removeAnimalModalButton = getRequiredElement<HTMLButtonElement>(
    "remove-animal-modal-button",
  );
  const closeAnimalModalButton = getRequiredElement<HTMLButtonElement>(
    "close-animal-modal-button",
  );
  let animalToPlace: AnimalType | null = null;

  farmScene.addChild(animalLayer);
  farmScene.addChild(player.view);
  app.stage.addChild(farmScene);

  const handleResize = (): void => centerScene(farmScene, app);
  const getPlayerCenterPosition = (): Position => ({
    x: player.view.x + PLAYER_SIZE / 2,
    y: player.view.y + PLAYER_SIZE / 2,
  });
  const animalSoundSystem = new AnimalSoundSystem(animalVoiceManager, {
    getPlayerPosition: getPlayerCenterPosition,
  });
  const animalWanderingSystem = new AnimalWanderingSystem();
  const modalController = new AnimalModalController<Animal>({
    voiceRecorder: animalVoiceManager,
    render: renderAnimalModal,
    renderRecordingTime,
    getErrorMessage,
    onRecordingFinished: (animal) => {
      animalSoundSystem.updateAnimal(animal);
    },
  });
  const updateGame = (ticker: Ticker): void => {
    player.update(input.getDirection(), ticker.deltaMS, gameBounds);
    animalWanderingSystem.update(ticker.deltaMS, gameBounds);
  };
  const handleAddAnimalClick = (): void => {
    animalPopup.classList.toggle("hidden");
  };
  const handleAnimalPopupClick = (event: MouseEvent): void => {
    const target = event.target;

    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const animalType = target.dataset.animal;

    if (!animalType || !isAnimalType(animalType)) {
      return;
    }

    modalController.selectAnimal(null);
    animalToPlace = animalType;
    animalPopup.classList.add("hidden");
  };
  const handleGroundPointerTap = (event: FederatedPointerEvent): void => {
    if (!animalToPlace) {
      modalController.selectAnimal(null);
      return;
    }

    const localPosition = farmScene.toLocal(event.global);
    const animal = createAnimalAt(
      animalToPlace,
      localPosition.x,
      localPosition.y,
      app.ticker,
    );

    animalWanderingSystem.addAnimal(animal);
    animals.push(animal);
    animal.view.on("pointertap", (animalEvent) => {
      animalEvent.stopPropagation();
      animalToPlace = null;
      animalPopup.classList.add("hidden");
      modalController.selectAnimal(animal);
    });
    animalLayer.addChild(animal.view);
    animalToPlace = null;
  };
  const handleRemoveSelectedAnimal = (): void => {
    const selectedAnimal = modalController.selectedAnimal;

    if (!selectedAnimal) {
      return;
    }

    const animal = selectedAnimal;
    const animalIndex = animals.indexOf(animal);

    modalController.cancelRecordingForAnimal(animal);
    animalSoundSystem.removeAnimal(animal);
    animalWanderingSystem.removeAnimal(animal);
    animalVoiceManager.removeAnimal(animal);

    if (animalIndex !== -1) {
      animals.splice(animalIndex, 1);
    }

    modalController.selectAnimal(null);
    animal.destroy();
  };
  const startRecordingForSelectedAnimal = async (): Promise<void> => {
    await modalController.startRecordingForSelectedAnimal();
  };
  const stopRecording = (): void => {
    modalController.stopRecording();
  };
  const deleteSelectedRecording = (): void => {
    const selectedAnimal = modalController.selectedAnimal;

    if (!selectedAnimal) {
      return;
    }

    animalVoiceManager.deleteRecording(selectedAnimal);
    animalSoundSystem.updateAnimal(selectedAnimal);
    modalController.modalError = "";
    renderAnimalModal();
  };
  const previewSelectedRecording = (): void => {
    const animal = modalController.selectedAnimal;

    if (!animal) {
      return;
    }

    animal.openMouth();
    const didStart = animalVoiceManager.previewRecording(animal, () => {
      animal.closeMouth();
    });

    if (!didStart) {
      animal.closeMouth();
    }
  };
  const closeAnimalModal = (): void => {
    modalController.selectAnimal(null);
  };
  function renderAnimalModal(): void {
    const animal = modalController.selectedAnimal;

    animalModal.classList.toggle("hidden", animal === null);

    if (!animal) {
      animalModalTitle.textContent = "";
      animalVoiceStatus.textContent = "";
      animalRecordingTime.textContent = "";
      return;
    }

    const isRecording = modalController.recordingAnimal === animal;
    const isRecordingPending =
      modalController.recordingPendingAnimal === animal;
    const isRecordingBusy = isRecording || isRecordingPending;
    const hasRecording = animalVoiceManager.hasRecording(animal);

    animalModalTitle.textContent = animal.type;
    animalVoiceStatus.textContent =
      modalController.modalError ||
      (isRecordingPending ? "Requesting microphone permission..." : "") ||
      (isRecording
        ? "Recording voice..."
        : hasRecording
          ? "Recorded voice ready."
          : "No recorded voice.");

    animalRecordingTime.classList.toggle("hidden", !isRecording);

    if (!isRecording) {
      animalRecordingTime.textContent = "";
    }

    recordVoiceButton.classList.toggle(
      "hidden",
      isRecordingBusy || hasRecording,
    );
    stopRecordingButton.classList.toggle("hidden", !isRecording);
    previewVoiceButton.classList.toggle(
      "hidden",
      isRecordingBusy || !hasRecording,
    );
    rerecordVoiceButton.classList.toggle(
      "hidden",
      isRecordingBusy || !hasRecording,
    );
    deleteRecordingButton.classList.toggle(
      "hidden",
      isRecordingBusy || !hasRecording,
    );
    removeAnimalModalButton.classList.toggle("hidden", isRecordingBusy);
  }
  function renderRecordingTime(elapsedMS: number): void {
    const elapsedSeconds = Math.min(
      Math.ceil(elapsedMS / 1000),
      MAX_RECORDING_DURATION_MS / 1000,
    );

    animalRecordingTime.textContent = `${elapsedSeconds}s / 10s`;
  }
  function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Recording failed.";
  }

  let cleanedUp = false;
  const cleanup = (): void => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    app.ticker.remove(updateGame);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("pagehide", cleanup);
    addAnimalButton.removeEventListener("click", handleAddAnimalClick);
    animalPopup.removeEventListener("click", handleAnimalPopupClick);
    recordVoiceButton.removeEventListener(
      "click",
      startRecordingForSelectedAnimal,
    );
    stopRecordingButton.removeEventListener("click", stopRecording);
    previewVoiceButton.removeEventListener("click", previewSelectedRecording);
    rerecordVoiceButton.removeEventListener(
      "click",
      startRecordingForSelectedAnimal,
    );
    deleteRecordingButton.removeEventListener("click", deleteSelectedRecording);
    removeAnimalModalButton.removeEventListener(
      "click",
      handleRemoveSelectedAnimal,
    );
    closeAnimalModalButton.removeEventListener("click", closeAnimalModal);
    ground.off("pointertap", handleGroundPointerTap);
    const recordingPendingAnimal = modalController.recordingPendingAnimal;
    const recordingAnimal = modalController.recordingAnimal;

    if (recordingPendingAnimal) {
      modalController.cancelRecordingForAnimal(recordingPendingAnimal);
    }

    if (recordingAnimal) {
      modalController.cancelRecordingForAnimal(recordingAnimal);
    }

    input.destroy();
    animalSoundSystem.destroy();
    animalWanderingSystem.destroy();
    animalVoiceManager.destroy();

    for (const animal of animals) {
      animal.destroy();
    }

    app.destroy(
      { removeView: true, releaseGlobalResources: true },
      { children: true },
    );
  };

  centerScene(farmScene, app);
  window.addEventListener("resize", handleResize);
  window.addEventListener("pagehide", cleanup);
  addAnimalButton.addEventListener("click", handleAddAnimalClick);
  animalPopup.addEventListener("click", handleAnimalPopupClick);
  recordVoiceButton.addEventListener("click", startRecordingForSelectedAnimal);
  stopRecordingButton.addEventListener("click", stopRecording);
  previewVoiceButton.addEventListener("click", previewSelectedRecording);
  rerecordVoiceButton.addEventListener(
    "click",
    startRecordingForSelectedAnimal,
  );
  deleteRecordingButton.addEventListener("click", deleteSelectedRecording);
  removeAnimalModalButton.addEventListener("click", handleRemoveSelectedAnimal);
  closeAnimalModalButton.addEventListener("click", closeAnimalModal);
  ground.on("pointertap", handleGroundPointerTap);

  app.ticker.add(updateGame);
})();
