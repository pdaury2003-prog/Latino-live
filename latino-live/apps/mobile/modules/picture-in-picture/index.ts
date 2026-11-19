import { requireOptionalNativeModule } from "expo";

/**
 * La ventana flotante de Android: la sala sigue viéndose y sonando en una
 * ventanita cuando la persona abre otra app. Solo existe en el teléfono; en
 * la vista previa del navegador no hay nada que abrir.
 */
type PictureInPictureNative = {
  isSupported: () => boolean;
  isEnabled: () => boolean;
  isInPictureInPicture: () => boolean;
  setEnabled: (enabled: boolean) => Promise<boolean>;
  enter: () => Promise<boolean>;
};

const native = requireOptionalNativeModule<PictureInPictureNative>("PictureInPicture");

export const PictureInPicture = {
  /** Whether this phone offers the floating window at all. */
  available: native != null,
  /** Whether Android on this phone can show the floating window. */
  isSupported: (): boolean => native?.isSupported() ?? false,
  /** Whether the floating window is armed for the screen you are on. */
  isEnabled: (): boolean => native?.isEnabled() ?? false,
  /** Whether the app is right now inside the floating window. */
  isInPictureInPicture: (): boolean => native?.isInPictureInPicture() ?? false,
  /**
   * Arms the floating window: from now on, leaving the app keeps the screen
   * alive in a small window. Resolves once Android has taken the setting.
   */
  setEnabled: (enabled: boolean): Promise<boolean> =>
    native?.setEnabled(enabled) ?? Promise.resolve(false),
  /** Opens the floating window on demand, without leaving the app. */
  enter: (): Promise<boolean> => native?.enter() ?? Promise.resolve(false),
};
