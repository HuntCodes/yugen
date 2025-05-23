import React, { useRef, useEffect } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';

export const MinimalSpinner = ({ size = 48, color = '#BDBDBD', thickness = 3 }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();
    return () => spin.stop();
  }, [rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}> 
      <Animated.View
        style={[
          styles.spinner,
          {
            borderColor: color,
            borderWidth: thickness,
            width: size,
            height: size,
            borderRadius: size / 2,
            borderRightColor: 'transparent',
            transform: [{ rotate: spin }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    borderStyle: 'solid',
    borderLeftColor: '#BDBDBD',
    borderTopColor: '#BDBDBD',
    borderBottomColor: '#BDBDBD',
    borderRightColor: 'transparent',
    position: 'absolute',
  },
}); 