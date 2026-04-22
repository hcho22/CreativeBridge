import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../../constants/theme';

export interface StepperProps {
  /** Zero-indexed current step. Steps with index < step render as completed, index === step as active, index > step as upcoming. */
  step: number;
  /** Ordered labels displayed under each step bubble. */
  steps: string[];
}

// Ported from /tmp/cb_design/components/screens-flow.jsx:6-49.
// Renders a horizontal row of N step bubbles joined by progress rails.
// Active step: foxglove fill with cream number.
// Completed: moss fill with check.
// Upcoming: paper-deep fill with ink-faint number and paper-edge border.
export const Stepper: React.FC<StepperProps> = ({ step, steps }) => {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {steps.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <React.Fragment key={`${i}-${label}`}>
              <View style={styles.stepColumn}>
                <View
                  style={[
                    styles.bubble,
                    done && styles.bubbleDone,
                    active && styles.bubbleActive,
                    !done && !active && styles.bubbleUpcoming,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleLabel,
                      (done || active) && styles.bubbleLabelEmphasized,
                    ]}
                  >
                    {done ? '✓' : i + 1}
                  </Text>
                </View>
                <Text
                  style={[styles.stepName, active && styles.stepNameActive]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
              {i < steps.length - 1 ? (
                <View style={styles.rail}>
                  <View
                    style={[styles.railFill, done && styles.railFillDone]}
                  />
                </View>
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

const BUBBLE_SIZE = 32;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32,
    paddingTop: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  stepColumn: {
    alignItems: 'center',
    gap: 4,
  },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleActive: {
    backgroundColor: theme.colors.accents.foxglove,
    ...theme.shadows.paper,
  },
  bubbleDone: {
    backgroundColor: theme.colors.accents.moss,
  },
  bubbleUpcoming: {
    backgroundColor: theme.colors.paper.deep,
    borderWidth: 1.5,
    borderColor: theme.colors.paper.edge,
  },
  bubbleLabel: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 15,
    color: theme.colors.ink.faint,
  },
  bubbleLabelEmphasized: {
    color: theme.colors.paper.cream,
  },
  stepName: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.colors.ink.faint,
  },
  stepNameActive: {
    color: theme.colors.accents.foxglove,
  },
  rail: {
    flex: 1,
    height: 2,
    marginTop: BUBBLE_SIZE / 2 - 1,
    marginHorizontal: 4,
    maxWidth: 80,
    backgroundColor: theme.colors.paper.edge,
    borderRadius: 2,
    overflow: 'hidden',
  },
  railFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  railFillDone: {
    backgroundColor: theme.colors.accents.moss,
  },
});

export default Stepper;
