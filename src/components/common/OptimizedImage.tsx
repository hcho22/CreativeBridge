import React from 'react';
import FastImage, { FastImageProps } from 'react-native-fast-image';
import { StyleSheet, ViewStyle, ImageStyle } from 'react-native';

interface OptimizedImageProps extends Omit<FastImageProps, 'style'> {
  style?: ViewStyle | ImageStyle;
  fallbackColor?: string;
}

const OptimizedImage: React.FC<OptimizedImageProps> = React.memo(
  ({
    source,
    style,
    fallbackColor = '#f0f0f0',
    resizeMode = 'cover',
    priority = 'normal',
    cache = 'immutable',
    ...props
  }) => {
    return (
      <FastImage
        source={source}
        style={[styles.image, { backgroundColor: fallbackColor }, style]}
        resizeMode={resizeMode}
        priority={priority}
        cache={cache}
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
