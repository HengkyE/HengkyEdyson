/**
 * Responsive design hooks for different screen sizes
 */

import { useState, useEffect } from 'react';
import { Dimensions, ScaledSize } from 'react-native';

interface ResponsiveBreakpoints {
  isPhone: boolean;
  isTablet: boolean;
  isSmallPhone: boolean;
  isLargeTablet: boolean;
  screenWidth: number;
  screenHeight: number;
}

export function useResponsive(): ResponsiveBreakpoints {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }: { window: ScaledSize }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const screenWidth = dimensions.width;
  const screenHeight = dimensions.height;
  
  // Common breakpoints
  const isTablet = screenWidth >= 768;
  const isSmallPhone = screenWidth < 375;
  const isLargeTablet = screenWidth >= 1024;

  return {
    isPhone: !isTablet,
    isTablet,
    isSmallPhone,
    isLargeTablet,
    screenWidth,
    screenHeight,
  };
}

/**
 * Get responsive font size based on screen size
 */
export function useResponsiveFontSize(baseSize: number): number {
  const { isTablet, isSmallPhone } = useResponsive();
  
  if (isTablet) {
    return baseSize * 1.2;
  }
  if (isSmallPhone) {
    return baseSize * 0.9;
  }
  return baseSize;
}

/**
 * Get responsive spacing based on screen size
 */
export function useResponsiveSpacing(baseSpacing: number): number {
  const { isTablet, isSmallPhone } = useResponsive();
  
  if (isTablet) {
    return baseSpacing * 1.5;
  }
  if (isSmallPhone) {
    return baseSpacing * 0.8;
  }
  return baseSpacing;
}

