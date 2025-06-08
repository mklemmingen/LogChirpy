/**
 * Date Picker Modal Component
 * 
 * Simplified modal component for date selection.
 * Uses the centralized modal system for better view hierarchy management.
 */

import React from 'react';
import { View, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/ThemedText';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ModernCard } from '@/components/ModernCard';
import type { DatePickerModalProps } from '@/types/modal';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';

interface DatePickerModalComponentProps extends DatePickerModalProps {}

export const DatePickerModal: React.FC<DatePickerModalComponentProps> = ({
  selectedDate,
  onDateChange,
  maximumDate,
  onClose,
}) => {
  const { t } = useTranslation();
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      onClose();
    }
    if (date) {
      onDateChange(date);
    }
  };

  const handleConfirm = () => {
    onDateChange(selectedDate);
    onClose();
  };

  return (
    <View style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      paddingHorizontal: dimensions.layout.screenPadding.horizontal,
    }}>
      <ModernCard style={{
        width: '100%',
        maxWidth: 400,
        padding: dimensions.card.padding.lg,
      }}>
        <ThemedText variant="h3" style={{
          marginBottom: dimensions.layout.componentSpacing,
          textAlign: 'center',
        }}>
          {t('log.select_date')}
        </ThemedText>

        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={maximumDate}
        />

        {Platform.OS === 'ios' && (
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: dimensions.layout.componentSpacing,
            gap: dimensions.layout.componentSpacing / 2,
          }}>
            <ThemedPressable
              variant="secondary"
              onPress={onClose}
              style={{ flex: 1 }}
            >
              <ThemedText variant="button">
                {t('common.cancel')}
              </ThemedText>
            </ThemedPressable>
            
            <ThemedPressable
              variant="primary"
              onPress={handleConfirm}
              style={{ flex: 1 }}
            >
              <ThemedText variant="button" color="primary">
                {t('common.confirm')}
              </ThemedText>
            </ThemedPressable>
          </View>
        )}
      </ModernCard>
    </View>
  );
};