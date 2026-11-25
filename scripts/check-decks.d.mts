export const DECK_DIR: string;
export const LEVELS: string[];
export const MIN_PER_LEVEL: Record<string, number>;
export const MAX_WORD_LENGTH: number;
export function whiteContrast(hex: string): number;
export function validateDeck(deck: unknown, file?: string): string[];
export function loadDeckFiles(): { file: string; deck: unknown }[];
