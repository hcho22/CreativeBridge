// Story Setup Questionnaire types for CreativeBridge
// Defines interfaces for the 4-step story setup wizard (US-001)

/**
 * Genre options available in the story setup wizard.
 * Display labels may vary by grade level (e.g., Horror → "Spooky" for K-2),
 * but the stored value always uses these canonical labels.
 */
export type { StoryGenre } from './database';
import type { StoryGenre } from './database';

/**
 * Character type options. "Animal" and "Custom" trigger inline expansion
 * for sub-selection (animal type or free-text description).
 */
export type CharacterType = 'Girl' | 'Boy' | 'Animal' | 'Custom';

/**
 * Animal sub-options shown when CharacterType is 'Animal'.
 * "Other" triggers a free-text input for custom animal type.
 */
export type AnimalType = 'Cat' | 'Dog' | 'Rabbit' | 'Owl' | 'Other';

/**
 * Setting options for where the story takes place.
 * "Custom" triggers a free-text input for custom setting.
 */
export type StorySetting = 'Forest' | 'Beach' | 'Castle' | 'Space' | 'Custom';

/**
 * Who writes the first part of the story.
 * 'ai' = AI generates the opening; 'user' = student writes the opening line.
 */
export type StoryStarter = 'ai' | 'user';

/**
 * Raw answers collected from the story setup wizard.
 * Null fields indicate the user skipped that question (AI decides).
 * The wizard passes this object back to HomeScreen via navigation params.
 */
export interface StorySetupAnswers {
  /** Selected genre, or null if skipped */
  genre: StoryGenre | null;

  /** Selected character type, or null if skipped */
  characterType: CharacterType | null;

  /** Animal sub-type when characterType is 'Animal', or null if not applicable/skipped */
  animalType: AnimalType | null;

  /** Custom animal description when animalType is 'Other', or null if not applicable */
  customAnimal: string | null;

  /** Custom character description when characterType is 'Custom', or null if not applicable */
  customCharacter: string | null;

  /** Optional character name (applies to all character types), or null if not provided */
  characterName: string | null;

  /** Selected story setting, or null if skipped */
  setting: StorySetting | null;

  /** Custom setting description when setting is 'Custom', or null if not applicable */
  customSetting: string | null;

  /** Who writes first — defaults to 'ai' when skipped */
  whoStarts: StoryStarter;
}

/**
 * Resolved setup values ready for the story generation pipeline.
 * Produced by resolveStorySetup() which fills in defaults for skipped answers.
 * Character and setting are undefined when the AI should decide.
 */
export interface ResolvedStorySetup {
  /** Resolved genre string (always provided — random pick if skipped) */
  genre: string;

  /** Resolved character description, or undefined if AI decides */
  character: string | undefined;

  /** User-chosen character name (e.g. "Eye Shadow"), or undefined if not provided */
  characterName: string | undefined;

  /** Resolved setting description, or undefined if AI decides */
  setting: string | undefined;

  /** Who writes first */
  whoStarts: StoryStarter;
}
