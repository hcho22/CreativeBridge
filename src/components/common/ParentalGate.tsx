/**
 * Parental Gate Component (US-009)
 *
 * Requires solving a simple math problem before opening external links.
 * This prevents children from navigating outside the app unsupervised.
 * The gate resets after each use — no persistent "parent mode."
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Linking,
  Alert,
} from 'react-native';

interface ParentalGateState {
  visible: boolean;
  pendingUrl: string | null;
  a: number;
  b: number;
}

function generateProblem(): { a: number; b: number } {
  const a = Math.floor(Math.random() * 30) + 10; // 10–39
  const b = Math.floor(Math.random() * 30) + 10; // 10–39
  return { a, b };
}

/**
 * Hook that provides a parental gate for external links.
 *
 * Usage:
 *   const { openURL, ParentalGateModal } = useParentalGate();
 *   // Replace Linking.openURL(url) with openURL(url)
 *   // Render <ParentalGateModal /> somewhere in the component tree
 */
export function useParentalGate() {
  const [state, setState] = useState<ParentalGateState>(() => ({
    visible: false,
    pendingUrl: null,
    ...generateProblem(),
  }));
  const [answer, setAnswer] = useState('');
  const inputRef = useRef<TextInput>(null);

  const openURL = useCallback((url: string) => {
    const problem = generateProblem();
    setState({ visible: true, pendingUrl: url, ...problem });
    setAnswer('');
  }, []);

  const handleCancel = useCallback(() => {
    setState(prev => ({ ...prev, visible: false, pendingUrl: null }));
    setAnswer('');
  }, []);

  const handleSubmit = useCallback(() => {
    const parsed = parseInt(answer, 10);
    if (parsed === state.a + state.b) {
      const url = state.pendingUrl;
      setState(prev => ({ ...prev, visible: false, pendingUrl: null }));
      setAnswer('');
      if (url) {
        Linking.openURL(url).catch(() => {
          Alert.alert('Error', 'Unable to open the link.');
        });
      }
    } else {
      setAnswer('');
      const problem = generateProblem();
      setState(prev => ({ ...prev, ...problem }));
      Alert.alert(
        'Incorrect',
        "That wasn't right. Please try again with the new problem.",
      );
    }
  }, [answer, state.a, state.b, state.pendingUrl]);

  const ParentalGateModal = useCallback(
    () => (
      <Modal
        visible={state.visible}
        animationType="fade"
        transparent
        onRequestClose={handleCancel}
        accessibilityViewIsModal
      >
        <View style={styles.backdrop}>
          <View style={styles.container}>
            <Text style={styles.title}>Grown-Up Check</Text>
            <Text style={styles.description}>
              Please ask a parent or guardian to answer this question to
              continue.
            </Text>
            <Text style={styles.problem}>
              What is {state.a} + {state.b}?
            </Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              keyboardType="number-pad"
              placeholder="Your answer"
              placeholderTextColor="#999"
              value={answer}
              onChangeText={setAnswer}
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
              autoFocus
              accessibilityLabel={`What is ${state.a} plus ${state.b}`}
            />
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  !answer && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!answer}
              >
                <Text style={styles.submitButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    ),
    [state.visible, state.a, state.b, answer, handleCancel, handleSubmit],
  );

  return { openURL, ParentalGateModal };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 32,
    width: '85%',
    maxWidth: 360,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  problem: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4A90D9',
    marginBottom: 16,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 12,
    fontSize: 18,
    textAlign: 'center',
    color: '#1A1A2E',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4A90D9',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
