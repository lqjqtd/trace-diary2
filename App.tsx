import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DiaryProvider, AuthProvider, ThemeProvider } from './src/context';
import { RootNavigator } from './src/navigation';
import { initializeStorage } from './src/api/storage';

export default function App() {
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeStorage();
        setIsStorageReady(true);
      } catch (error) {
        console.error('Failed to initialize storage:', error);
        setStorageError(error instanceof Error ? error.message : 'Unknown storage error');
        setIsStorageReady(true);
      }
    };
    init();
  }, []);

  if (!isStorageReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (storageError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>存储初始化失败</Text>
        <Text style={styles.errorMessage}>请重新打开应用。如仍无法进入，请联系开发者并提供以下信息：</Text>
        <Text style={styles.errorDetail}>{storageError}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <DiaryProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </DiaryProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F5F5F0',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: '#666666',
    marginBottom: 12,
  },
  errorDetail: {
    fontSize: 13,
    lineHeight: 18,
    color: '#999999',
  },
});
