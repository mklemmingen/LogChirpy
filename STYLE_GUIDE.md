# LogChirpy Style Guide

## Core Principles

1. **Consistency First**: Every styling decision should align with our design system
2. **Theme-Driven**: All visual properties must come from the theme
3. **Component-Based**: Use themed components exclusively
4. **Performance**: Prefer StyleSheet.create() for static styles

## Component Usage

### DO Use Themed Components

```typescript
// CORRECT
import { ThemedView, ThemedText, ThemedPressable } from '@/components';

<ThemedView>
  <ThemedText variant="h2">Title</ThemedText>
  <ThemedPressable onPress={handlePress}>
    <ThemedText>Press me</ThemedText>
  </ThemedPressable>
</ThemedView>
```

### DON'T Use Native Components Directly

```typescript
// INCORRECT
import { View, Text, Pressable } from 'react-native';

<View>
  <Text>Title</Text>
  <Pressable onPress={handlePress}>
    <Text>Press me</Text>
  </Pressable>
</View>
```

## Spacing System

Use only these spacing values from the theme:

```typescript
theme.spacing = {
  xs: 4,   // Tight spacing
  sm: 8,   // Small elements
  md: 12,  // Default spacing
  lg: 16,  // Standard gaps
  xl: 24,  // Section spacing
  xxl: 32, // Large sections
  xxxl: 48,// Extra large gaps
  huge: 64 // Page-level spacing
}
```

### Usage Examples

```typescript
// CORRECT - Using theme spacing
const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  item: {
    marginBottom: theme.spacing.sm,
  }
});

// INCORRECT - Hard-coded values
const styles = StyleSheet.create({
  container: {
    padding: 20,  //  Use theme.spacing.xl instead
    gap: 10,      // Use theme.spacing.md instead
  }
});
```

## Color System

### Never Hard-Code Colors

```typescript
// INCORRECT
backgroundColor: '#000'
backgroundColor: 'rgba(0,0,0,0.5)'
color: 'white'

// CORRECT
backgroundColor: theme.colors.background.primary
backgroundColor: theme.colors.overlay.medium
color: theme.colors.text.primary
```

### Color Categories

- **Background**: `theme.colors.background.*`
- **Text**: `theme.colors.text.*`
- **Border**: `theme.colors.border.*`
- **Status**: `theme.colors.status.*`
- **Overlay**: `theme.colors.overlay.*`

## Typography

### Text Component Usage

Always use `ThemedText` with appropriate variants:

```typescript
// Headers
<ThemedText variant="h1">Main Title</ThemedText>
<ThemedText variant="h2">Section Title</ThemedText>
<ThemedText variant="h3">Subsection</ThemedText>

// Body Text
<ThemedText variant="body">Regular text</ThemedText>
<ThemedText variant="bodyLarge">Emphasized text</ThemedText>
<ThemedText variant="bodySmall">Supporting text</ThemedText>

// Special Text
<ThemedText variant="button">Button Label</ThemedText>
<ThemedText variant="caption">Caption text</ThemedText>
<ThemedText variant="label">Form Label</ThemedText>
```

### Never Use

```typescript
//  INCORRECT
<Text style={{ fontSize: 16 }}>Text</Text>
<ThemedText style={{ fontSize: 16 }}>Text</ThemedText>
```

## Button Standards

### Primary Actions

Use `ThemedPressable` for all interactive elements:

```typescript
// Standard Button
<ThemedPressable variant="primary" size="md" onPress={handlePress}>
  <ThemedText variant="button">Action</ThemedText>
</ThemedPressable>

// Icon Button
<ThemedPressable variant="ghost" size="sm" onPress={handlePress}>
  <ThemedIcon name="plus" />
</ThemedPressable>

// Full Width Button
<ThemedPressable variant="primary" fullWidth onPress={handlePress}>
  <ThemedText variant="button">Continue</ThemedText>
</ThemedPressable>
```

### Button Variants

- `primary`: Main actions
- `secondary`: Secondary actions
- `ghost`: Subtle actions
- `danger`: Destructive actions

### Button Sizes

- `sm`: Icon buttons, compact areas
- `md`: Default size
- `lg`: Primary CTAs

## Border Radius

Use only theme border radius values:

```typescript
theme.borderRadius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999, // For pills/circles
}
```

### Usage

```typescript
// Card
borderRadius: theme.borderRadius.lg

// Button
borderRadius: theme.borderRadius.md

// Avatar
borderRadius: theme.borderRadius.full

// Input
borderRadius: theme.borderRadius.sm
```

## Shadows

Always use theme shadows:

```typescript
// Elevation levels
...theme.shadows.sm  // Subtle elevation
...theme.shadows.md  // Cards, modals
...theme.shadows.lg  // Floating elements
```

## Layout Patterns

### Flex Layouts

```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: theme.spacing.md, // Use gap for spacing
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  }
});
```

### Don't Use Margins Between Items

```typescript
// INCORRECT
<View style={{ marginBottom: 16 }}>...</View>
<View style={{ marginBottom: 16 }}>...</View>

// CORRECT
<View style={{ gap: theme.spacing.lg }}>
  <View>...</View>
  <View>...</View>
</View>
```

## Style Organization

### Component Structure

```typescript
// 1. Imports
import { StyleSheet } from 'react-native';
import { ThemedView, ThemedText } from '@/components';
import { useTheme } from '@/hooks/useThemeColor';

// 2. Component
export function MyComponent() {
  const theme = useTheme();
  
  return (
    <ThemedView style={styles.container}>
      <ThemedText variant="h2">Title</ThemedText>
    </ThemedView>
  );
}

// 3. Styles (after component, using theme via closure)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
  }
});
```

### Dynamic Styles

```typescript
// For dynamic values, use inline styles
<ThemedView 
  style={[
    styles.card,
    isActive && styles.cardActive,
    { opacity: animated.value } // Dynamic only
  ]}
/>
```

## Icon Usage

Always use `ThemedIcon`:

```typescript
// With semantic colors
<ThemedIcon name="check" color="success" />
<ThemedIcon name="alert-circle" color="error" />

// With standard colors
<ThemedIcon name="menu" color="primary" />
<ThemedIcon name="chevron-right" color="secondary" />
```

## Form Elements

### Input Fields

```typescript
<ThemedView style={styles.inputContainer}>
  <ThemedText variant="label">{label}</ThemedText>
  <TextInput
    style={[styles.input, { color: theme.colors.text.primary }]}
    placeholderTextColor={theme.colors.text.tertiary}
  />
</ThemedView>

const styles = StyleSheet.create({
  inputContainer: {
    gap: theme.spacing.xs,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background.secondary,
  }
});
```

## Responsive Design

### Safe Areas

```typescript
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();

<ThemedView style={{ paddingTop: insets.top }}>
  ...
</ThemedView>
```

### Platform-Specific Styles

```typescript
const styles = StyleSheet.create({
  shadow: {
    ...Platform.select({
      ios: theme.shadows.md,
      android: { elevation: 4 }
    })
  }
});
```

## Animation Guidelines

### Use Reanimated 2

```typescript
import Animated, { 
  useAnimatedStyle, 
  withSpring,
  withTiming 
} from 'react-native-reanimated';

// Spring for interactive animations
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(scale.value) }]
}));

// Timing for transitions
const fadeStyle = useAnimatedStyle(() => ({
  opacity: withTiming(opacity.value, { duration: 200 })
}));
```

## Code Review Checklist

Before submitting code, ensure:

- [ ] No hard-coded colors
- [ ] No hard-coded spacing values
- [ ] Using themed components only
- [ ] StyleSheet.create() for static styles
- [ ] Theme spacing scale used consistently
- [ ] Theme border radius values used
- [ ] Proper text variants applied
- [ ] No inline fontSize or direct typography
- [ ] Buttons use ThemedPressable
- [ ] Icons use ThemedIcon
- [ ] Shadows from theme only
- [ ] Gap property for layout spacing

## Migration Guide

### Converting Existing Components

1. Replace native components with themed versions
2. Replace hard-coded values with theme values
3. Move inline styles to StyleSheet where possible
4. Ensure consistent spacing scale usage
5. Test in both light and dark modes