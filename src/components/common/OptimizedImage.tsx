import React from 'react';
import {
  Image,
  ImageProps,
  StyleSheet,
  ViewStyle,
  ImageStyle,
} from 'react-native';

interface OptimizedImageProps extends Omit<ImageProps, 'style'> {
  style?: ViewStyle | ImageStyle;
  fallbackColor?: string;
}

const OptimizedImage: React.FC<OptimizedImageProps> = React.memo(
  ({
    source,
    style,
    fallbackColor = '#f0f0f0',
    resizeMode = 'cover',
    ...props
  }) => {
    return (
      <Image
        source={source}
        style={
          [
            styles.image,
            { backgroundColor: fallbackColor },
            style,
          ] as ImageStyle
        }
        resizeMode={resizeMode}
        {...props}
      />
    );
  },
);

OptimizedImage.displayName = 'OptimizedImage';

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#f0f0f0',
  },
});

export default OptimizedImage;
