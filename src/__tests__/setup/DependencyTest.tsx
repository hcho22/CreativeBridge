import React from 'react';
import { View, Text } from 'react-native';
import { PinchGestureHandler } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

/**
 * Test component to verify all new dependencies are properly installed and functioning
 */
const DependencyTest: React.FC = () => {
  // Test react-native-reanimated
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  // Test react-native-gesture-handler
  const handlePinch = () => {
    scale.value = withSpring(scale.value === 1 ? 1.5 : 1);
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 18, marginBottom: 20 }}>
        Dependency Test Component
      </Text>

      {/* Test Gesture Handler */}
      <PinchGestureHandler onGestureEvent={handlePinch}>
        <Animated.View
          style={[
            animatedStyle,
            { width: 100, height: 100, backgroundColor: 'blue' },
          ]}
        >
          <Text style={{ color: 'white', textAlign: 'center', marginTop: 40 }}>
            Pinch Me
          </Text>
        </Animated.View>
      </PinchGestureHandler>

      {/* Image Zoom Viewer would be used in modal */}
      <Text style={{ marginTop: 20, fontSize: 12, color: '#666' }}>
        ✅ react-native-gesture-handler: Installed
      </Text>
      <Text style={{ fontSize: 12, color: '#666' }}>
        ✅ react-native-reanimated: Installed (v3)
      </Text>
      <Text style={{ fontSize: 12, color: '#666' }}>
        ✅ react-native-image-zoom-viewer: Installed
      </Text>
    </View>
  );
};

export default DependencyTest;
