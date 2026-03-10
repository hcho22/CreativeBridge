/**
 * Story Setup Default Resolution
 *
 * Resolves skipped (null) questionnaire answers into concrete values
 * the story generation pipeline can consume. Genre always resolves
 * to a concrete string; character and setting may remain undefined
 * (AI decides).
 */

import {
  StoryGenre,
  StorySetupAnswers,
  ResolvedStorySetup,
} from '../types/storySetup';

/** All canonical genre values for random selection. */
const GENRES: StoryGenre[] = [
  'Mystery',
  'Fantasy',
  'Comedy',
  'Horror',
  'Fiction',
  'Fairy Tale',
];

/** Pick a random genre from the canonical list. */
function randomGenre(): string {
  return GENRES[Math.floor(Math.random() * GENRES.length)];
}

/**
 * Resolves raw wizard answers into pipeline-ready values.
 *
 * @param answers - Raw wizard answers, or undefined if wizard was skipped entirely
 * @returns Resolved setup with genre (always string), optional character/setting, and whoStarts
 */
export function resolveStorySetup(
  answers?: StorySetupAnswers,
): ResolvedStorySetup {
  // No wizard answers at all — full defaults
  if (!answers) {
    return {
      genre: randomGenre(),
      character: undefined,
      setting: undefined,
      whoStarts: 'ai',
    };
  }

  return {
    genre: resolveGenre(answers.genre),
    character: resolveCharacter(answers),
    setting: resolveSetting(answers.setting, answers.customSetting),
    whoStarts: answers.whoStarts ?? 'ai',
  };
}

// ── Genre resolution ────────────────────────────

function resolveGenre(genre: StoryGenre | null): string {
  return genre ?? randomGenre();
}

// ── Character resolution ────────────────────────

function resolveCharacter(answers: StorySetupAnswers): string | undefined {
  const {
    characterType,
    animalType,
    customAnimal,
    customCharacter,
    characterName,
  } = answers;

  if (characterType === null) {
    return undefined;
  }

  let base: string | undefined;

  switch (characterType) {
    case 'Girl':
    case 'Boy':
      base = characterType;
      break;

    case 'Animal':
      base = resolveAnimal(animalType, customAnimal);
      break;

    case 'Custom':
      base = customCharacter?.trim() || undefined;
      break;
  }

  if (!base) {
    return undefined;
  }

  // Append name if provided
  const name = characterName?.trim();
  if (name) {
    return `${base} named ${name}`;
  }

  return base;
}

function resolveAnimal(
  animalType: StorySetupAnswers['animalType'],
  customAnimal: string | null,
): string {
  if (animalType === null) {
    return 'Animal';
  }

  if (animalType === 'Other') {
    const custom = customAnimal?.trim();
    return custom || 'Animal';
  }

  // Preset animal: Cat, Dog, Rabbit, Owl
  return animalType;
}

// ── Setting resolution ──────────────────────────

function resolveSetting(
  setting: StorySetupAnswers['setting'],
  customSetting: string | null,
): string | undefined {
  if (setting === null) {
    return undefined;
  }

  if (setting === 'Custom') {
    return customSetting?.trim() || undefined;
  }

  // Preset setting: Forest, Beach, Castle, Space
  return setting;
}
