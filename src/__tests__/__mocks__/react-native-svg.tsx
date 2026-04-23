// Jest mock for `react-native-svg`.
//
// The upstream package's `SvgTouchableMixin` destructures `Touchable.Mixin`
// from `react-native` at module-load time, and the legacy `Touchable.Mixin`
// API was removed from React Native 0.81. That makes any Jest test that
// transitively imports `react-native-svg` fail with
// `TypeError: Cannot read properties of undefined (reading 'Mixin')`
// before a single line of test code runs.
//
// This mock exports the subset of components used by
// `src/components/common/storybook/*` (Svg, Path, Line, Circle, Ellipse,
// Defs, RadialGradient, Stop). Each stub is a React component that accepts
// arbitrary props and renders its children inside a <View>, so
// @testing-library/react-native can still traverse the tree and assert on
// text content inside SVG nodes.

import React from 'react';
import { View } from 'react-native';

type SvgStubProps = { children?: React.ReactNode } & Record<string, unknown>;

const makeStub = (displayName: string) => {
  const Component = ({ children }: SvgStubProps) =>
    React.createElement(View, null, children);
  Component.displayName = `SvgMock.${displayName}`;
  return Component;
};

export const Svg = makeStub('Svg');
export const Path = makeStub('Path');
export const Line = makeStub('Line');
export const Circle = makeStub('Circle');
export const Ellipse = makeStub('Ellipse');
export const Defs = makeStub('Defs');
export const RadialGradient = makeStub('RadialGradient');
export const LinearGradient = makeStub('LinearGradient');
export const Stop = makeStub('Stop');
export const G = makeStub('G');
export const Rect = makeStub('Rect');
export const Polygon = makeStub('Polygon');
export const Polyline = makeStub('Polyline');
export const Text = makeStub('Text');
export const TSpan = makeStub('TSpan');
export const ClipPath = makeStub('ClipPath');
export const Mask = makeStub('Mask');
export const Use = makeStub('Use');
export const Symbol = makeStub('Symbol');

export default Svg;
