import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth, useTheme } from '../context';
import { AuthScreen } from '../screens';
import { AppNavigator } from './AppNavigator';

export function RootNavigator() {
  const { state } = useAuth();
  const { colors } = useTheme();

  if (state.isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {state.isAppLockEnabled && !state.isAuthenticated ? (
        <AuthScreen />
      ) : (
        <AppNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default RootNavigator;
