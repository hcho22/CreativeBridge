// Storybook raster asset barrel (US-003).
// Each PNG is re-exported as a typed `ImageSourcePropType` so downstream
// screens can `import { castle } from '@/assets/storybook'` and pass it
// straight to `<Image source={...}>` or `<Watercolor imageSource={...}>`.
//
// Filenames with hyphens (`custom-char.png`, `mystery-box.png`) are exposed
// under camelCased identifiers (`customChar`, `mysteryBox`) — the on-disk
// filename is unchanged so Metro resolves it correctly.

import type { ImageSourcePropType } from 'react-native';

// Characters
export const animal = require('./animal.png') as ImageSourcePropType;
export const boy = require('./boy.png') as ImageSourcePropType;
export const girl = require('./girl.png') as ImageSourcePropType;
export const customChar = require('./custom-char.png') as ImageSourcePropType;
export const wizard = require('./wizard.png') as ImageSourcePropType;

// Settings
export const beach = require('./beach.png') as ImageSourcePropType;
export const castle = require('./castle.png') as ImageSourcePropType;
export const forest = require('./forest.png') as ImageSourcePropType;
export const space = require('./space.png') as ImageSourcePropType;

// Genres
export const comedy = require('./comedy.png') as ImageSourcePropType;
export const fairytale = require('./fairytale.png') as ImageSourcePropType;
export const fantasy = require('./fantasy.png') as ImageSourcePropType;
export const fiction = require('./fiction.png') as ImageSourcePropType;
export const mysteryBox = require('./mystery-box.png') as ImageSourcePropType;
export const suspense = require('./suspense.png') as ImageSourcePropType;

// Voice-dock icons
export const keyboard = require('./keyboard.png') as ImageSourcePropType;
export const megaphone = require('./megaphone.png') as ImageSourcePropType;
export const mic = require('./mic.png') as ImageSourcePropType;
export const speaker = require('./speaker.png') as ImageSourcePropType;

// Misc writing iconography
export const quill = require('./quill.png') as ImageSourcePropType;

// Convenience grouped object for iteration (e.g. dev galleries, test harnesses).
// Exporting individual names above keeps tree-shaking viable; this object is a
// secondary ergonomic surface for callers that need to enumerate all 20.
export const storybookAssets = {
  animal,
  beach,
  boy,
  castle,
  comedy,
  customChar,
  fairytale,
  fantasy,
  fiction,
  forest,
  girl,
  keyboard,
  megaphone,
  mic,
  mysteryBox,
  quill,
  space,
  speaker,
  suspense,
  wizard,
} as const;

export type StorybookAssetName = keyof typeof storybookAssets;
