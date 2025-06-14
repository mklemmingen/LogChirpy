# LogChirpy UX-First Style Guide

## Core UX Principles

1. **Accessibility First**: Every component must be usable by all users
2. **Consistent Contrast**: No same-color text/background combinations ever
3. **Adaptive Design**: Components scale beautifully across all screen sizes
4. **Theme-Driven**: All visual properties come from the centralized theme
5. **Performance**: Optimized for smooth 60fps interactions

## Critical UX Rules

### ❌ **NEVER DO**
- Hard-code colors that could create same-color conflicts
- Use fixed sizes that don't adapt to screen dimensions
- Create text that doesn't stretch to available space
- Skip accessibility properties on interactive elements
- Use colors without verifying contrast ratios

### ✅ **ALWAYS DO**
- Use theme color hooks that guarantee contrast
- Implement responsive sizing with screen-aware dimensions
- Allow text to flex and wrap naturally
- Include proper accessibility labels and hints
- Test components in both light and dark modes

## Enhanced Color System

### Unified Color Hook (Required)

Replace all color hooks with this single, conflict-safe hook:

```typescript
// hooks/useUnifiedColors.ts
export function useUnifiedColors() {
  const theme = useTheme();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  return {
    // Text colors with guaranteed contrast
    text: {
      primary: theme.colors.text.primary,      // Always contrasts with background.primary
      secondary: theme.colors.text.secondary,  // Always contrasts with background.primary
      tertiary: theme.colors.text.tertiary,    // Always contrasts with background.primary
      inverse: theme.colors.text.inverse,      // Always contrasts with interactive.primary
      disabled: theme.colors.text.disabled,   // Reduced contrast but still accessible
      onSecondary: isDark ? '#FFFFFF' : '#000000', // For secondary backgrounds
      onTertiary: isDark ? '#FFFFFF' : '#000000',  // For tertiary backgrounds
    },
    
    // Background colors with contrast guarantees
    background: {
      primary: theme.colors.background.primary,     // Main background
      secondary: theme.colors.background.secondary, // Slightly different from primary
      tertiary: theme.colors.background.tertiary,   // Card backgrounds
      elevated: theme.colors.background.elevated,   // Floating elements
      overlay: theme.colors.overlay.medium,         // Modal backgrounds
    },
    
    // Interactive colors with proper text pairs
    interactive: {
      primary: theme.colors.interactive.primary,
      primaryText: theme.colors.text.inverse,
      secondary: theme.colors.interactive.secondary,
      secondaryText: theme.colors.text.primary,
      ghost: 'transparent',
      ghostText: theme.colors.text.primary,
      disabled: theme.colors.interactive.disabled,
      disabledText: theme.colors.text.disabled,
    },
    
    // Status colors with text pairs
    status: {
      success: theme.colors.status.success,
      successText: '#FFFFFF',
      warning: theme.colors.status.warning,
      warningText: '#000000',
      error: theme.colors.status.error,
      errorText: '#FFFFFF',
      info: theme.colors.status.info,
      infoText: isDark ? '#000000' : '#FFFFFF',
    },
    
    // Border and accent colors
    border: {
      primary: theme.colors.border.primary,
      secondary: theme.colors.border.secondary,
      strong: theme.colors.border.strong,
      focus: theme.colors.border.focus,
    },
    
    // Semantic colors for specific use cases
    semantic: {
      destructive: theme.colors.status.error,
      destructiveText: '#FFFFFF',
      accent: theme.colors.accent?.primary || theme.colors.interactive.primary,
      accentText: '#FFFFFF',
    }
  };
}
```

### Color Usage Rules

```typescript
// ✅ CORRECT - Always use paired colors
const colors = useUnifiedColors();

<View style={{ backgroundColor: colors.interactive.primary }}>
  <Text style={{ color: colors.interactive.primaryText }}>Button</Text>
</View>

<View style={{ backgroundColor: colors.background.secondary }}>
  <Text style={{ color: colors.text.onSecondary }}>Card Content</Text>
</View>

// ❌ INCORRECT - Never mix unpaired colors
<View style={{ backgroundColor: colors.background.secondary }}>
  <Text style={{ color: colors.text.secondary }}>Might not have enough contrast!</Text>
</View>
```

## Responsive Component Sizing

### Screen-Aware Dimensions

```typescript
// hooks/useResponsiveDimensions.ts
export function useResponsiveDimensions() {
  const { width, height } = useWindowDimensions();
  const { fontScale } = useWindowDimensions();
  
  // Screen size categories
  const isSmall = width < 375;
  const isMedium = width >= 375 && width < 414;
  const isLarge = width >= 414;
  
  // Component size multipliers
  const sizeMultiplier = isSmall ? 0.9 : isLarge ? 1.1 : 1.0;
  const spacingMultiplier = isSmall ? 0.85 : isLarge ? 1.15 : 1.0;
  
  return {
    screen: { width, height, isSmall, isMedium, isLarge },
    multipliers: { size: sizeMultiplier, spacing: spacingMultiplier },
    fontScale,
    
    // Responsive component sizes
    button: {
      sm: { height: 36 * sizeMultiplier, paddingHorizontal: 12 * spacingMultiplier },
      md: { height: 44 * sizeMultiplier, paddingHorizontal: 16 * spacingMultiplier },
      lg: { height: 52 * sizeMultiplier, paddingHorizontal: 24 * spacingMultiplier },
    },
    
    input: {
      sm: { height: 36 * sizeMultiplier, paddingHorizontal: 12 * spacingMultiplier },
      md: { height: 44 * sizeMultiplier, paddingHorizontal: 16 * spacingMultiplier },
      lg: { height: 52 * sizeMultiplier, paddingHorizontal: 20 * spacingMultiplier },
    },
    
    card: {
      padding: {
        sm: 12 * spacingMultiplier,
        md: 16 * spacingMultiplier,
        lg: 24 * spacingMultiplier,
      },
      minHeight: 80 * sizeMultiplier,
    },
    
    // Touch target sizes (accessibility)
    touchTarget: {
      minimum: Math.max(44 * sizeMultiplier, 44), // Never below 44pt
      comfortable: Math.max(48 * sizeMultiplier, 48),
      large: Math.max(56 * sizeMultiplier, 56),
    },
  };
}
```

### Responsive Text System

```typescript
// Enhanced typography with responsive scaling
export function useResponsiveTypography() {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const colors = useUnifiedColors();
  
  // Limit font scale to prevent UI breaking
  const safeScale = Math.min(fontScale, 1.3);
  
  return {
    h1: {
      ...theme.typography.h1,
      fontSize: theme.typography.h1.fontSize * safeScale,
      color: colors.text.primary,
      maxFontSizeMultiplier: 1.3,
    },
    h2: {
      ...theme.typography.h2,
      fontSize: theme.typography.h2.fontSize * safeScale,
      color: colors.text.primary,
      maxFontSizeMultiplier: 1.3,
    },
    h3: {
      ...theme.typography.h3,
      fontSize: theme.typography.h3.fontSize * safeScale,
      color: colors.text.primary,
      maxFontSizeMultiplier: 1.3,
    },
    body: {
      ...theme.typography.body,
      fontSize: theme.typography.body.fontSize * safeScale,
      color: colors.text.primary,
      maxFontSizeMultiplier: 1.4,
    },
    bodySmall: {
      ...theme.typography.bodySmall,
      fontSize: theme.typography.bodySmall.fontSize * safeScale,
      color: colors.text.secondary,
      maxFontSizeMultiplier: 1.4,
    },
    button: {
      ...theme.typography.button,
      fontSize: theme.typography.button.fontSize * safeScale,
      color: colors.text.primary,
      maxFontSizeMultiplier: 1.2,
    },
    caption: {
      ...theme.typography.caption,
      fontSize: theme.typography.caption.fontSize * safeScale,
      color: colors.text.tertiary,
      maxFontSizeMultiplier: 1.5,
    },
    label: {
      ...theme.typography.label,
      fontSize: theme.typography.label.fontSize * safeScale,
      color: colors.text.secondary,
      maxFontSizeMultiplier: 1.3,
    },
  };
}
```

## Enhanced Component Standards

### Accessible Button Component

```typescript
// components/AccessibleButton.tsx
interface AccessibleButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: string;
  rightIcon?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export function AccessibleButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: AccessibleButtonProps) {
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();
  const typography = useResponsiveTypography();
  
  const buttonConfig = dimensions.button[size];
  const touchConfig = dimensions.touchTarget;
  
  // Ensure minimum touch target
  const minHeight = Math.max(buttonConfig.height, touchConfig.minimum);
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.interactive.primary,
          textColor: colors.interactive.primaryText,
        };
      case 'secondary':
        return {
          backgroundColor: colors.interactive.secondary,
          textColor: colors.interactive.secondaryText,
          borderWidth: 1,
          borderColor: colors.border.primary,
        };
      case 'ghost':
        return {
          backgroundColor: colors.interactive.ghost,
          textColor: colors.interactive.ghostText,
        };
      case 'destructive':
        return {
          backgroundColor: colors.semantic.destructive,
          textColor: colors.semantic.destructiveText,
        };
    }
  };
  
  const variantStyles = getVariantStyles();
  
  return (
    <ThemedPressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading }}
      testID={testID}
      style={[
        {
          height: minHeight,
          paddingHorizontal: buttonConfig.paddingHorizontal,
          backgroundColor: variantStyles.backgroundColor,
          borderRadius: theme.borderRadius.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          opacity: disabled ? 0.5 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        variantStyles.borderWidth && {
          borderWidth: variantStyles.borderWidth,
          borderColor: variantStyles.borderColor,
        },
      ]}
    >
      {leftIcon && !loading && (
        <ThemedIcon name={leftIcon} size={16} color={variantStyles.textColor} />
      )}
      {loading ? (
        <ActivityIndicator size="small" color={variantStyles.textColor} />
      ) : (
        <ThemedText
          style={[
            typography.button,
            { color: variantStyles.textColor },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {title}
        </ThemedText>
      )}
      {rightIcon && !loading && (
        <ThemedIcon name={rightIcon} size={16} color={variantStyles.textColor} />
      )}
    </ThemedPressable>
  );
}
```

### Adaptive Text Component

```typescript
// Enhanced ThemedText with responsive behavior
interface EnhancedThemedTextProps extends TextProps {
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'button' | 'caption' | 'label';
  color?: 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'disabled' | 'accent';
  center?: boolean;
  semiBold?: boolean;
  adaptiveWidth?: boolean; // Text stretches to fill available space
  maxLines?: number;
  truncate?: boolean;
}

export function EnhancedThemedText({
  variant = 'body',
  color = 'primary',
  center = false,
  semiBold = false,
  adaptiveWidth = true,
  maxLines,
  truncate = false,
  children,
  style,
  ...props
}: EnhancedThemedTextProps) {
  const typography = useResponsiveTypography();
  const colors = useUnifiedColors();
  
  const getTextColor = () => {
    switch (color) {
      case 'primary': return colors.text.primary;
      case 'secondary': return colors.text.secondary;
      case 'tertiary': return colors.text.tertiary;
      case 'inverse': return colors.text.inverse;
      case 'disabled': return colors.text.disabled;
      case 'accent': return colors.semantic.accent;
      default: return colors.text.primary;
    }
  };
  
  const variantStyle = typography[variant];
  
  return (
    <Text
      {...props}
      style={[
        variantStyle,
        {
          color: getTextColor(),
          textAlign: center ? 'center' : 'left',
          fontWeight: semiBold ? '600' : variantStyle.fontWeight,
          flexShrink: adaptiveWidth ? 1 : 0,
          flexGrow: adaptiveWidth ? 1 : 0,
        },
        style,
      ]}
      numberOfLines={maxLines}
      ellipsizeMode={truncate ? 'tail' : undefined}
      maxFontSizeMultiplier={variantStyle.maxFontSizeMultiplier}
      adjustsFontSizeToFit={!maxLines && variant !== 'caption'}
      minimumFontScale={0.8}
    >
      {children}
    </Text>
  );
}
```

### Responsive Card Component

```typescript
// components/ResponsiveCard.tsx
interface ResponsiveCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'glass';
  padding?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
  style?: ViewStyle;
}

export function ResponsiveCard({
  children,
  variant = 'default',
  padding = 'md',
  interactive = false,
  disabled = false,
  onPress,
  testID,
  style,
}: ResponsiveCardProps) {
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();
  const theme = useTheme();
  
  const paddingValue = dimensions.card.padding[padding];
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.background.elevated,
          ...theme.shadows.md,
        };
      case 'outlined':
        return {
          backgroundColor: colors.background.primary,
          borderWidth: 1,
          borderColor: colors.border.primary,
        };
      case 'glass':
        return {
          backgroundColor: colors.background.overlay,
          backdropFilter: 'blur(10px)', // iOS only
        };
      default:
        return {
          backgroundColor: colors.background.tertiary,
        };
    }
  };
  
  const variantStyles = getVariantStyles();
  const Component = interactive ? ThemedPressable : ThemedView;
  
  return (
    <Component
      onPress={interactive ? onPress : undefined}
      disabled={disabled}
      testID={testID}
      accessibilityRole={interactive ? 'button' : undefined}
      style={[
        {
          padding: paddingValue,
          borderRadius: theme.borderRadius.lg,
          minHeight: dimensions.card.minHeight,
          opacity: disabled ? 0.5 : 1,
        },
        variantStyles,
        style,
      ]}
    >
      {children}
    </Component>
  );
}
```

## Layout Best Practices

### Adaptive Container Patterns

```typescript
// Use this pattern for all screen containers
function ScreenContainer({ children }: { children: React.ReactNode }) {
  const dimensions = useResponsiveDimensions();
  const colors = useUnifiedColors();
  const insets = useSafeAreaInsets();
  
  return (
    <ThemedSafeAreaView 
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: dimensions.screen.isSmall ? 16 : 24,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 16,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </ThemedSafeAreaView>
  );
}
```

### Flexible Text Layout

```typescript
// ✅ CORRECT - Text that adapts to available space
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
  <ThemedIcon name="user" size={24} color="primary" />
  <EnhancedThemedText 
    variant="body" 
    adaptiveWidth={true}
    numberOfLines={2}
    style={{ flex: 1 }}
  >
    This text will wrap and fill the available space properly
  </EnhancedThemedText>
  <EnhancedThemedText variant="caption" color="secondary">
    Status
  </EnhancedThemedText>
</View>

// ❌ INCORRECT - Fixed width text that doesn't adapt
<View style={{ flexDirection: 'row' }}>
  <Text style={{ width: 200, fontSize: 16 }}>Fixed width text</Text>
</View>
```

## Accessibility Requirements

### Mandatory Accessibility Props

```typescript
// All interactive components MUST include:
<ThemedPressable
  accessibilityRole="button"
  accessibilityLabel="Descriptive label for screen readers"
  accessibilityHint="What happens when pressed"
  accessibilityState={{ disabled, selected, checked }}
  testID="unique-test-identifier"
>
  <Content />
</ThemedPressable>

// Text components with important information:
<EnhancedThemedText
  accessibilityRole="text"
  accessibilityLabel="Full context for screen readers"
>
  Abbreviated text
</EnhancedThemedText>
```

### Color Contrast Validation

```typescript
// Use this utility to validate color combinations
function validateColorContrast(foreground: string, background: string): boolean {
  // Implementation of WCAG 2.1 contrast ratio calculation
  const ratio = getContrastRatio(foreground, background);
  return ratio >= 4.5; // WCAG AA standard
}

// Example usage in component development
const colors = useUnifiedColors();
const isValidContrast = validateColorContrast(
  colors.text.secondary, 
  colors.background.secondary
);

if (!isValidContrast) {
  console.warn('Color combination does not meet accessibility standards');
}
```

## Component Testing Checklist

### Before Submitting Any Component

- [ ] **Color Contrast**: All text/background combinations pass WCAG AA (4.5:1)
- [ ] **Responsive Design**: Component works on 320px to 1024px+ widths
- [ ] **Text Scaling**: Component handles 200% font scaling gracefully
- [ ] **Touch Targets**: All interactive elements meet 44pt minimum
- [ ] **Accessibility**: Proper labels, hints, and roles assigned
- [ ] **Theme Compatibility**: Works perfectly in both light and dark modes
- [ ] **Keyboard Navigation**: Component is keyboard accessible (if applicable)
- [ ] **Screen Reader**: Component announces correctly with VoiceOver/TalkBack
- [ ] **Performance**: No layout shifts or jank during interactions
- [ ] **Edge Cases**: Handles very long text, empty states, and loading states

### Device Testing Requirements

Test on:
- Small screen (iPhone SE dimensions)
- Large screen (iPhone Pro Max dimensions)
- Tablet (iPad dimensions)
- High contrast mode
- Reduced motion settings
- Large text accessibility settings

## Performance Optimization

### Layout Performance

```typescript
// ✅ EFFICIENT - Use StyleSheet.create for static styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: theme.spacing.md,
  },
});

// ✅ EFFICIENT - Use getItemLayout for FlatLists
<FlatList
  data={items}
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
  removeClippedSubviews={false} // For complex items
  maxToRenderPerBatch={10}
  windowSize={5}
/>

// ❌ INEFFICIENT - Inline styles cause re-renders
<View style={{ padding: 16, backgroundColor: 'white' }} />
```

### Animation Performance

```typescript
// ✅ EFFICIENT - Use native-driven animations
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(scale.value) }],
  opacity: withTiming(opacity.value, { duration: 200 }),
}));

// ✅ EFFICIENT - Use layout animations for complex changes
import { LayoutAnimation } from 'react-native';

const handleStateChange = () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  setState(newState);
};
```

## Updated Code Review Checklist

### Before Every Commit

- [ ] **No Hard-coded Colors**: All colors come from useUnifiedColors()
- [ ] **No Hard-coded Sizes**: All dimensions use responsive hooks
- [ ] **Proper Text Scaling**: Text uses EnhancedThemedText with proper variants
- [ ] **Accessibility Complete**: All interactive elements have proper a11y props
- [ ] **Contrast Verified**: All color combinations tested in both themes
- [ ] **Responsive Tested**: Component tested on multiple screen sizes
- [ ] **Performance Optimized**: No unnecessary re-renders or layout calculations
- [ ] **Theme Consistent**: Follows spacing, typography, and color systems
- [ ] **Touch Targets**: All buttons meet minimum 44pt requirement
- [ ] **Error Handling**: Component handles loading, error, and empty states

### Automatic Checks (Recommended)

Set up ESLint rules to automatically catch:
- Hard-coded color values
- Hard-coded spacing values
- Missing accessibility props
- Improper font size usage
- Non-themed component usage

This enhanced style guide ensures every component provides excellent UX across all devices and accessibility needs while maintaining perfect visual consistency.