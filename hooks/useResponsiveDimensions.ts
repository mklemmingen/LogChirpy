import { useWindowDimensions } from 'react-native';
import { useTheme } from './useThemeColor';

/**
 * Responsive Dimensions Hook - Provides screen-aware sizing and spacing
 * 
 * This hook ensures that components scale appropriately across different screen sizes
 * and provides responsive sizing multipliers for consistent UX across devices.
 */
export function useResponsiveDimensions() {
  const { width, height, fontScale } = useWindowDimensions();
  const theme = useTheme();
  
  // Screen size categories
  const isSmall = width < 375;
  const isMedium = width >= 375 && width < 414;
  const isLarge = width >= 414;
  const isTablet = width >= 768;
  
  // Component size multipliers
  const sizeMultiplier = isSmall ? 0.9 : isLarge ? 1.1 : 1.0;
  const spacingMultiplier = isSmall ? 0.85 : isLarge ? 1.15 : 1.0;
  const tabletMultiplier = isTablet ? 1.3 : 1.0;
  
  // Limit font scale to prevent UI breaking
  const safeFontScale = Math.min(fontScale, 1.3);
  
  return {
    // Screen information
    screen: { 
      width, 
      height, 
      isSmall, 
      isMedium, 
      isLarge,
      isTablet,
    },
    
    // Multipliers for responsive scaling
    multipliers: { 
      size: sizeMultiplier * tabletMultiplier, 
      spacing: spacingMultiplier * tabletMultiplier,
      font: safeFontScale,
    },
    
    // Font scale information
    fontScale: safeFontScale,
    
    // Responsive component sizes
    button: {
      sm: { 
        height: Math.max(36 * sizeMultiplier, 36), 
        paddingHorizontal: 12 * spacingMultiplier,
        minWidth: 80 * sizeMultiplier,
      },
      md: { 
        height: Math.max(44 * sizeMultiplier, 44), 
        paddingHorizontal: 16 * spacingMultiplier,
        minWidth: 100 * sizeMultiplier,
      },
      lg: { 
        height: Math.max(52 * sizeMultiplier, 52), 
        paddingHorizontal: 24 * spacingMultiplier,
        minWidth: 120 * sizeMultiplier,
      },
    },
    
    // Input field dimensions
    input: {
      sm: { 
        height: Math.max(36 * sizeMultiplier, 36), 
        paddingHorizontal: 12 * spacingMultiplier,
        fontSize: 14 * safeFontScale,
      },
      md: { 
        height: Math.max(44 * sizeMultiplier, 44), 
        paddingHorizontal: 16 * spacingMultiplier,
        fontSize: 16 * safeFontScale,
      },
      lg: { 
        height: Math.max(52 * sizeMultiplier, 52), 
        paddingHorizontal: 20 * spacingMultiplier,
        fontSize: 18 * safeFontScale,
      },
    },
    
    // Card component dimensions
    card: {
      padding: {
        sm: Math.max(12 * spacingMultiplier, 8),
        md: Math.max(16 * spacingMultiplier, 12),
        lg: Math.max(24 * spacingMultiplier, 20),
        xl: Math.max(32 * spacingMultiplier, 24),
      },
      minHeight: Math.max(80 * sizeMultiplier, 60),
      borderRadius: {
        sm: theme.borderRadius.sm,
        md: theme.borderRadius.md,
        lg: theme.borderRadius.lg,
        xl: theme.borderRadius.xl,
      },
    },
    
    // Touch target sizes (accessibility)
    touchTarget: {
      minimum: Math.max(44 * sizeMultiplier, 44), // Never below 44pt
      comfortable: Math.max(48 * sizeMultiplier, 48),
      large: Math.max(56 * sizeMultiplier, 56),
      extraLarge: Math.max(64 * sizeMultiplier, 64),
    },
    
    // Icon sizes
    icon: {
      xs: Math.max(12 * sizeMultiplier, 12),
      sm: Math.max(16 * sizeMultiplier, 16),
      md: Math.max(20 * sizeMultiplier, 20),
      lg: Math.max(24 * sizeMultiplier, 24),
      xl: Math.max(32 * sizeMultiplier, 32),
      xxl: Math.max(48 * sizeMultiplier, 48),
    },
    
    // Modal and overlay dimensions
    modal: {
      maxWidth: isTablet ? width * 0.6 : width * 0.9,
      maxHeight: height * 0.8,
      padding: isTablet ? 32 : 24,
      borderRadius: theme.borderRadius.lg,
    },
    
    // List item dimensions
    listItem: {
      minHeight: Math.max(44 * sizeMultiplier, 44),
      padding: {
        horizontal: 16 * spacingMultiplier,
        vertical: 12 * spacingMultiplier,
      },
      gap: 12 * spacingMultiplier,
    },
    
    // Navigation and tab bar dimensions
    navigation: {
      headerHeight: isTablet ? 64 : 56,
      tabBarHeight: isTablet ? 70 : 60,
      tabIconSize: Math.max(24 * sizeMultiplier, 24),
    },
    
    // Screen padding and margins
    layout: {
      screenPadding: {
        horizontal: isTablet ? 32 : isSmall ? 16 : 20,
        vertical: isTablet ? 24 : 16,
      },
      sectionSpacing: isTablet ? 32 : 24,
      componentSpacing: 16 * spacingMultiplier,
    },
  };
}

/**
 * Screen Size Breakpoint Hook
 * 
 * Provides boolean flags for common responsive design breakpoints
 */
export function useScreenBreakpoints() {
  const { width } = useWindowDimensions();
  
  return {
    xs: width < 320,
    sm: width >= 320 && width < 375,
    md: width >= 375 && width < 414,
    lg: width >= 414 && width < 768,
    xl: width >= 768 && width < 1024,
    xxl: width >= 1024,
    
    // Semantic breakpoints
    mobile: width < 768,
    tablet: width >= 768 && width < 1024,
    desktop: width >= 1024,
    
    // Orientation helpers
    isPortrait: width < 768, // Assume portrait on mobile
    isLandscape: width >= 768, // Assume landscape on larger screens
  };
}

/**
 * Safe Area Responsive Hook
 * 
 * Provides responsive safe area handling for different screen sizes
 */
export function useResponsiveSafeArea() {
  const { screen } = useResponsiveDimensions();
  
  // Adjust safe area handling based on screen size
  const multiplier = screen.isTablet ? 1.5 : screen.isSmall ? 0.8 : 1.0;
  
  return {
    // Minimum safe area values
    top: Math.max(20 * multiplier, 16),
    bottom: Math.max(20 * multiplier, 16),
    left: Math.max(16 * multiplier, 12),
    right: Math.max(16 * multiplier, 12),
    
    // Content insets
    contentInset: {
      top: 16 * multiplier,
      bottom: 16 * multiplier,
      horizontal: screen.isTablet ? 32 : 20,
    },
  };
}

/**
 * Component Size Helper Hook
 * 
 * Provides quick access to common component size configurations
 */
export function useComponentSizes() {
  const dimensions = useResponsiveDimensions();
  
  return {
    // Quick size configurations for common components
    smallButton: dimensions.button.sm,
    mediumButton: dimensions.button.md,
    largeButton: dimensions.button.lg,
    
    smallInput: dimensions.input.sm,
    mediumInput: dimensions.input.md,
    largeInput: dimensions.input.lg,
    
    compactCard: { ...dimensions.card, padding: dimensions.card.padding.sm },
    standardCard: { ...dimensions.card, padding: dimensions.card.padding.md },
    spaciousCard: { ...dimensions.card, padding: dimensions.card.padding.lg },
    
    // Common icon sizes
    iconXS: dimensions.icon.xs,
    iconSM: dimensions.icon.sm,
    iconMD: dimensions.icon.md,
    iconLG: dimensions.icon.lg,
    iconXL: dimensions.icon.xl,
    
    // Touch targets
    minTouch: dimensions.touchTarget.minimum,
    comfortableTouch: dimensions.touchTarget.comfortable,
    largeTouch: dimensions.touchTarget.large,
  };
}