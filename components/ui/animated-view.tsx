/**
 * Animated view component for smooth transitions
 */

import React, { useEffect } from 'react';
import { Animated, View, ViewStyle, StyleProp } from 'react-native';

interface AnimatedViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
  fadeIn?: boolean;
  slideIn?: 'up' | 'down' | 'left' | 'right';
}

export function AnimatedView({
  children,
  style,
  delay = 0,
  duration = 300,
  fadeIn = true,
  slideIn,
}: AnimatedViewProps) {
  const fadeAnim = React.useRef(new Animated.Value(fadeIn ? 0 : 1)).current;
  const slideAnim = React.useRef(
    new Animated.Value(slideIn ? (slideIn === 'up' || slideIn === 'left' ? 50 : -50) : 0)
  ).current;

  useEffect(() => {
    const animations: Animated.CompositeAnimation[] = [];

    if (fadeIn) {
      animations.push(
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration,
          delay,
          useNativeDriver: true,
        })
      );
    }

    if (slideIn) {
      animations.push(
        Animated.timing(slideAnim, {
          toValue: 0,
          duration,
          delay,
          useNativeDriver: true,
        })
      );
    }

    if (animations.length > 0) {
      Animated.parallel(animations).start();
    }
  }, [fadeAnim, slideAnim, delay, duration, fadeIn, slideIn]);

  const getTranslateStyle = () => {
    if (!slideIn) return {};
    
    switch (slideIn) {
      case 'up':
        return { transform: [{ translateY: slideAnim }] };
      case 'down':
        return { transform: [{ translateY: slideAnim }] };
      case 'left':
        return { transform: [{ translateX: slideAnim }] };
      case 'right':
        return { transform: [{ translateX: slideAnim }] };
      default:
        return {};
    }
  };

  return (
    <Animated.View
      style={[
        {
          opacity: fadeAnim,
          ...getTranslateStyle(),
        },
        style,
      ]}>
      {children}
    </Animated.View>
  );
}

interface FadeInViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
}

export function FadeInView({ children, style, delay = 0, duration = 300 }: FadeInViewProps) {
  return (
    <AnimatedView fadeIn delay={delay} duration={duration} style={style}>
      {children}
    </AnimatedView>
  );
}

interface SlideInViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
}

export function SlideInView({
  children,
  style,
  direction = 'up',
  delay = 0,
  duration = 300,
}: SlideInViewProps) {
  return (
    <AnimatedView slideIn={direction} delay={delay} duration={duration} style={style}>
      {children}
    </AnimatedView>
  );
}

