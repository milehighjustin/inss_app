/**
 * Installing is a browser idea.
 *
 * A native build is already installed — there is no home-screen copy to add — so
 * the Account screen gets an empty answer and shows nothing.
 */
export interface InstallState {
  /** Whether there is anything to say on this platform at all. */
  available: boolean;
  /** Running as an installed app right now. */
  installed: boolean;
  /** The browser can raise its own install prompt. */
  canPrompt: boolean;
  /** What to do when it cannot: one line of steps, or null. */
  steps: string | null;
  /** Raises the browser's prompt. */
  prompt: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

const NOTHING_TO_INSTALL: InstallState = {
  available: false,
  installed: false,
  canPrompt: false,
  steps: null,
  prompt: async () => 'unavailable',
};

export function useInstallState(): InstallState {
  return NOTHING_TO_INSTALL;
}
