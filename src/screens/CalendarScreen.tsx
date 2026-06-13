import React, { useState, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  Text, 
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar, DiaryCard } from '../components';
import { useDiary } from '../context';
import { useTheme } from '../context/ThemeProvider';
import { Layout, Typography } from '../constants';
import { RootStackParamList } from '../types';
import { formatDateId, formatDateDisplay } from '../utils/dateUtils';
import { getEntriesForDate } from '../utils/diaryIdentity';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function CalendarScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { state } = useDiary();
  const { colors, isDark } = useTheme();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const selectedEntries = getEntriesForDate(state.entries, selectedDate);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleCardPress = useCallback(() => {
    navigation.navigate('Editor', { date: formatDateId(selectedDate) });
  }, [navigation, selectedDate]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>日历</Text>
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Calendar
          entries={state.entries}
          onDateSelect={handleDateSelect}
          selectedDate={selectedDate}
        />

        <View style={styles.selectedSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {formatDateDisplay(selectedDate)}
          </Text>
          
          {selectedEntries.length > 0 ? (
            <>
              {selectedEntries.map((entry) => (
                <DiaryCard
                  key={entry.id}
                  entry={entry}
                  onPress={() => navigation.navigate('DiaryDetail', { entryId: entry.id })}
                />
              ))}
              <TouchableOpacity
                style={[styles.addAnotherCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                onPress={handleCardPress}
                activeOpacity={0.7}
              >
                <Text style={[styles.addAnotherText, { color: colors.primary }]}>再写一篇</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              style={[styles.noEntryCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]} 
              onPress={handleCardPress} 
              activeOpacity={0.7}
            >
              <Text style={[styles.noEntryText, { color: colors.textSecondary }]}>这一天还没有记录</Text>
              <Text style={[styles.noEntryHint, { color: colors.primary }]}>点击添加日记</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  selectedSection: {
    marginTop: Layout.spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    paddingHorizontal: Layout.spacing.md,
    marginBottom: Layout.spacing.sm,
  },
  noEntryCard: {
    marginHorizontal: Layout.spacing.md,
    padding: Layout.spacing.xl,
    borderRadius: Layout.borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  noEntryText: {
    fontSize: Typography.fontSize.base,
    marginBottom: Layout.spacing.xs / 2,
  },
  noEntryHint: {
    fontSize: Typography.fontSize.sm,
  },
  addAnotherCard: {
    marginHorizontal: Layout.spacing.md,
    marginTop: Layout.spacing.xs,
    paddingVertical: Layout.spacing.md,
    borderRadius: Layout.borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addAnotherText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
});

export default CalendarScreen;
