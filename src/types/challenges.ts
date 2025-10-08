export interface Challenge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  xpReward: number;
  validationPatterns: string[];
  gradeLevel: string[];
}

export interface ChallengeProgress {
  challengeId: string;
  isCompleted: boolean;
  completedAt?: Date;
  userText?: string;
  xpEarned: number;
}

export interface XPReward {
  type: 'challenge' | 'word_count' | 'completion' | 'bonus';
  amount: number;
  description: string;
}

export const CHALLENGE_DEFINITIONS: Challenge[] = [
  // Universal challenges (all grade levels)
  {
    id: 'dialogue',
    title: 'Include dialogue between characters',
    description: 'Make your characters talk to each other',
    emoji: '💬',
    xpReward: 25,
    validationPatterns: [
      '"',
      '"',
      '"',
      'said',
      'asked',
      'replied',
      'answered',
      'shouted',
      'whispered',
      'exclaimed',
    ],
    gradeLevel: ['K-2', '3-5', '6-8', '9-12'],
  },
  {
    id: 'character_feelings',
    title: 'Describe how a character feels',
    description: 'Show emotions and feelings',
    emoji: '😊',
    xpReward: 20,
    validationPatterns: [
      'happy',
      'sad',
      'excited',
      'scared',
      'angry',
      'worried',
      'nervous',
      'proud',
      'felt',
      'feeling',
    ],
    gradeLevel: ['K-2', '3-5', '6-8', '9-12'],
  },
  {
    id: 'action_scene',
    title: 'Add an action scene',
    description: 'Include movement and activity',
    emoji: '⚡',
    xpReward: 25,
    validationPatterns: [
      'run',
      'ran',
      'jump',
      'jumped',
      'chase',
      'fight',
      'race',
      'hurry',
      'rush',
      'quickly',
    ],
    gradeLevel: ['K-2', '3-5', '6-8', '9-12'],
  },

  // K-2 specific challenges
  {
    id: 'colors',
    title: 'Use colorful descriptions',
    description: 'Add colors to make your story bright',
    emoji: '🌈',
    xpReward: 15,
    validationPatterns: [
      'red',
      'blue',
      'green',
      'yellow',
      'purple',
      'orange',
      'pink',
      'colorful',
      'bright',
      'shiny',
    ],
    gradeLevel: ['K-2'],
  },
  {
    id: 'animals',
    title: 'Include an animal character',
    description: 'Add a friendly animal to your story',
    emoji: '🐾',
    xpReward: 20,
    validationPatterns: [
      'dog',
      'cat',
      'bird',
      'rabbit',
      'bear',
      'fox',
      'owl',
      'mouse',
      'frog',
      'butterfly',
    ],
    gradeLevel: ['K-2'],
  },

  // 3-5 specific challenges
  {
    id: 'problem_solving',
    title: 'Show a character solving a problem',
    description: 'Make your character figure something out',
    emoji: '🧩',
    xpReward: 30,
    validationPatterns: [
      'solve',
      'figured out',
      'found a way',
      'idea',
      'solution',
      'think',
      'thought',
      'clever',
    ],
    gradeLevel: ['3-5', '6-8'],
  },
  {
    id: 'setting_description',
    title: 'Describe the setting in detail',
    description: 'Paint a picture of where your story happens',
    emoji: '🏞️',
    xpReward: 25,
    validationPatterns: [
      'forest',
      'mountain',
      'castle',
      'school',
      'beach',
      'beautiful',
      'tall',
      'ancient',
      'mysterious',
    ],
    gradeLevel: ['3-5', '6-8', '9-12'],
  },

  // 6-8 specific challenges
  {
    id: 'inner_conflict',
    title: "Show a character's inner thoughts",
    description: 'Reveal what your character is thinking',
    emoji: '🤔',
    xpReward: 35,
    validationPatterns: [
      'thought',
      'wondered',
      'realized',
      'felt',
      'knew',
      'understood',
      'believed',
      'doubted',
    ],
    gradeLevel: ['6-8', '9-12'],
  },
  {
    id: 'tough_decision',
    title: 'Make a character face a difficult choice',
    description: 'Create a moment where choosing is hard',
    emoji: '⚖️',
    xpReward: 40,
    validationPatterns: [
      'decision',
      'choose',
      'choice',
      'difficult',
      'hard',
      'between',
      'either',
      'or',
      'must decide',
    ],
    gradeLevel: ['6-8', '9-12'],
  },

  // 9-12 specific challenges
  {
    id: 'theme_exploration',
    title: 'Explore a deeper theme',
    description:
      'Include meaningful themes like friendship, courage, or growth',
    emoji: '🎯',
    xpReward: 50,
    validationPatterns: [
      'friendship',
      'courage',
      'brave',
      'growth',
      'change',
      'learn',
      'sacrifice',
      'justice',
      'truth',
    ],
    gradeLevel: ['9-12'],
  },
  {
    id: 'plot_twist',
    title: 'Add an unexpected plot twist',
    description: 'Surprise your readers with something unexpected',
    emoji: '🔄',
    xpReward: 45,
    validationPatterns: [
      'suddenly',
      'unexpected',
      'surprise',
      'shocked',
      'twist',
      'however',
      'but then',
      'plot twist',
    ],
    gradeLevel: ['9-12'],
  },
];

export const XP_BONUSES = {
  CHALLENGE_COMPLETION: 25, // Base XP per challenge
  WORD_COUNT_BONUS: 2, // XP per 5 words written
  STORY_COMPLETION: 100, // XP for completing a story
  PERFECT_GAME: 50, // XP for completing all challenges
  SPEED_BONUS: 30, // XP for quick completion
  CREATIVITY_BONUS: 25, // XP for creative writing
};
