import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface TestErrorComponentProps {
  onError?: () => void;
}

const TestErrorComponent: React.FC<TestErrorComponentProps> = ({ onError }) => {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    // This will trigger the ErrorBoundary
    throw new Error(
      'Test error thrown from TestErrorComponent for ErrorBoundary testing',
    );
  }

  const handleThrowError = () => {
    onError?.();
    setShouldThrow(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Error Boundary Test</Text>
      <Text style={styles.description}>
        This component is only visible in development mode. Tap the button below
        to test the ErrorBoundary functionality.
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleThrowError}>
        <Text style={styles.buttonText}>Throw Test Error</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    margin: 20,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 16,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TestErrorComponent;
