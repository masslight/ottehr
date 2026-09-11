export const isMacPlatform = (): boolean => typeof navigator !== 'undefined' && !!navigator.platform?.includes('Mac');

/** Platform-native label for a modifier shortcut: "⌘K" on Mac, "Ctrl+K" elsewhere. */
export const shortcutLabel = (key: string): string => (isMacPlatform() ? `⌘${key}` : `Ctrl+${key}`);
