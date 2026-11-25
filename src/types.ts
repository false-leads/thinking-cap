export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: readonly Level[] = ['easy', 'medium', 'hard'];

export const LEVEL_LABELS: Record<Level, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export interface Deck {
  id: string;
  name: string;
  emoji: string;
  /** Background color; must keep white text readable. */
  color: string;
  blurb?: string;
  /** Extra instruction for the describers, e.g. "Act it out. No talking!" */
  hint?: string;
  words: Record<Level, string[]>;
  /** Made or imported on this device (not shipped with the app). */
  custom?: boolean;
}

/** One word as it appears in a round. */
export interface Card {
  text: string;
  level: Level;
  deckId: string;
}

export type Outcome = 'correct' | 'pass';

export interface RoundResult {
  deckId: string;
  cards: { card: Card; outcome: Outcome }[];
}
