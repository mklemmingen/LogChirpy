/**
 * Confidence Indicator Component
 * 
 * Implements whoBIRD-style color-coded confidence visualization
 * Based on whoBIRD confidence thresholds and colors
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedIcon } from '@/components/ThemedIcon';

interface ConfidenceIndicatorProps {
  confidence: number; // 0-1 range
  variant?: 'default' | 'compact' | 'detailed';
  showIcon?: boolean;
  showPercentage?: boolean;
}

/**
 * whoBIRD confidence thresholds and colors:
 * < 30%: Red dotted (very low confidence)
 * 30-50%: Red (low confidence)  
 * 50-65%: Orange (medium-low confidence)
 * 65-80%: Yellow (medium-high confidence)
 * 80%+: Green (high confidence)
 */
const getConfidenceLevel = (confidence: number) => {
  if (confidence < 0.3) return { level: 'very_low', color: 'error' as const, bgColor: '#EF4444' };
  if (confidence < 0.5) return { level: 'low', color: 'error' as const, bgColor: '#EF4444' };
  if (confidence < 0.65) return { level: 'medium_low', color: 'secondary' as const, bgColor: '#F59E0B' };
  if (confidence < 0.8) return { level: 'medium_high', color: 'secondary' as const, bgColor: '#F59E0B' };
  return { level: 'high', color: 'success' as const, bgColor: '#10B981' };
};

const getConfidenceText = (confidence: number) => {
  const level = getConfidenceLevel(confidence);
  switch (level.level) {
    case 'very_low': return 'Very Low';
    case 'low': return 'Low';
    case 'medium_low': return 'Medium';
    case 'medium_high': return 'Good';
    case 'high': return 'High';
    default: return 'Unknown';
  }
};

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  variant = 'default',
  showIcon = true,
  showPercentage = true,
}) => {
  const { color, bgColor } = getConfidenceLevel(confidence);
  const percentage = Math.round(confidence * 100);

  if (variant === 'compact') {
    return (
      <View style={[styles.compactContainer, { backgroundColor: bgColor + '20' }]}>
        {showIcon && (
          <ThemedIcon 
            name="check-circle" 
            size={12} 
            color={color}
          />
        )}
        <ThemedText variant="caption" color={color}>
          {showPercentage ? `${percentage}%` : getConfidenceText(confidence)}
        </ThemedText>
      </View>
    );
  }

  if (variant === 'detailed') {
    return (
      <View style={styles.detailedContainer}>
        <View style={styles.detailedHeader}>
          {showIcon && (
            <ThemedIcon 
              name="check-circle" 
              size={16} 
              color={color}
            />
          )}
          <ThemedText variant="labelMedium" color={color}>
            {getConfidenceText(confidence)} Confidence
          </ThemedText>
          {showPercentage && (
            <ThemedText variant="labelMedium" color={color}>
              {percentage}%
            </ThemedText>
          )}
        </View>
        
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBackground, { backgroundColor: bgColor + '20' }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${percentage}%`, 
                  backgroundColor: bgColor
                }
              ]} 
            />
          </View>
        </View>
        
        {/* Threshold markers */}
        <View style={styles.thresholdContainer}>
          <View style={[styles.thresholdMarker, { left: '30%' }]} />
          <View style={[styles.thresholdMarker, { left: '50%' }]} />
          <View style={[styles.thresholdMarker, { left: '65%' }]} />
          <View style={[styles.thresholdMarker, { left: '80%' }]} />
        </View>
      </View>
    );
  }

  // Default variant
  return (
    <View style={[styles.defaultContainer, { backgroundColor: bgColor + '15' }]}>
      {showIcon && (
        <ThemedIcon 
          name="check-circle" 
          size={14} 
          color={color}
        />
      )}
      <ThemedText variant="label" color={color}>
        {showPercentage ? `${percentage}%` : getConfidenceText(confidence)}
      </ThemedText>
    </View>
  );
};

const styles = StyleSheet.create({
  defaultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  detailedContainer: {
    gap: 8,
    paddingVertical: 8,
  },
  detailedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  progressContainer: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBackground: {
    flex: 1,
    borderRadius: 3,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  thresholdContainer: {
    position: 'relative',
    height: 4,
    marginTop: 2,
  },
  thresholdMarker: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: '#666',
    opacity: 0.3,
  },
});