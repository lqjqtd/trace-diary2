import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeProvider';
import { Layout, Typography } from '../constants';

interface PinInputProps {
  onComplete: (pin: string) => void;
  onBiometric?: () => void;
  biometricAvailable?: boolean;
  title?: string;
  subtitle?: string;
  pinLength?: number;
  error?: string;
}

export function PinInput({
  onComplete,
  onBiometric,
  biometricAvailable = false,
  title = '输入 PIN 码',
  subtitle,
  pinLength = 4,
  error,
}: PinInputProps) {
  const [pin, setPin] = useState('');
  const [showError, setShowError] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    if (error) {
      setShowError(true);
      Vibration.vibrate(200);
      setTimeout(() => {
        setPin('');
        setShowError(false);
      }, 1000);
    }
  }, [error]);

  useEffect(() => {
    if (pin.length === pinLength) {
      onComplete(pin);
    }
  }, [pin, pinLength, onComplete]);

  const handlePress = (value: string) => {
    if (pin.length < pinLength) {
      setPin((prev) => prev + value);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const renderDots = () => {
    return (
      <View style={styles.dotsContainer}>
        {Array(pinLength)
          .fill(0)
          .map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                { borderColor: colors.primary },
                pin.length > index && { backgroundColor: colors.primary },
                showError && { borderColor: colors.error, backgroundColor: colors.error },
              ]}
            />
          ))}
      </View>
    );
  };

  const renderKeypad = () => {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      [biometricAvailable ? 'bio' : '', '0', 'del'],
    ];

    return (
      <View style={styles.keypad}>
        {keys.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key, keyIndex) => {
              if (key === '') {
                return <View key={keyIndex} style={styles.keyEmpty} />;
              }

              if (key === 'bio') {
                return (
                  <TouchableOpacity
                    key={keyIndex}
                    style={[styles.key, { backgroundColor: colors.cardBackground }]}
                    onPress={onBiometric}
                    activeOpacity={0.7}
                    accessibilityLabel="使用生物识别解锁"
                  >
                    <Feather name="smartphone" size={24} color={colors.textPrimary} />
                  </TouchableOpacity>
                );
              }

              if (key === 'del') {
                return (
                  <TouchableOpacity
                    key={keyIndex}
                    style={[styles.key, { backgroundColor: colors.cardBackground }]}
                    onPress={handleDelete}
                    activeOpacity={0.7}
                    accessibilityLabel="删除"
                  >
                    <Feather name="delete" size={24} color={colors.textPrimary} />
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={keyIndex}
                  style={[styles.key, { backgroundColor: colors.cardBackground }]}
                  onPress={() => handlePress(key)}
                  activeOpacity={0.7}
                  accessibilityLabel={`数字 ${key}`}
                >
                  <Text style={[styles.keyText, { color: colors.textPrimary }]}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
        {error && showError && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
      </View>
      {renderDots()}
      {renderKeypad()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Layout.spacing.xl,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Layout.spacing.sm,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },
  error: {
    fontSize: Typography.fontSize.sm,
    marginTop: Layout.spacing.sm,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Layout.spacing.xxl,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginHorizontal: Layout.spacing.sm,
  },
  keypad: {
    width: '100%',
    maxWidth: 300,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Layout.spacing.md,
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  keyEmpty: {
    width: 72,
    height: 72,
  },
  keyText: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.medium,
  },
});

export default PinInput;
