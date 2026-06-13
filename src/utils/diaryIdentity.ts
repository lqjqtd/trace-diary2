import { DiaryEntry } from '../types';
import { formatDateId, formatTime } from './dateUtils';

export const createDiaryTimestampForDate = (dateId: string, now: Date = new Date()): number => {
  const [year, month, day] = dateId.split('-').map(Number);
  const timestamp = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), 0, 0);
  return timestamp.getTime();
};

export const createDiaryEntryId = (timestamp: number, existingIds: Set<string>): string => {
  const baseId = `${formatDateId(timestamp)}-${formatTime(timestamp).replace(':', '')}`;
  if (!existingIds.has(baseId)) return baseId;

  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseId}-${suffix}`;
};

export const getDiaryDateId = (entry: Pick<DiaryEntry, 'id' | 'date'>): string => {
  if (Number.isFinite(entry.date)) {
    return formatDateId(entry.date);
  }
  return entry.id.slice(0, 10);
};

export const getEntriesForDate = (entries: DiaryEntry[], date: Date | number): DiaryEntry[] => {
  const dateId = formatDateId(date);
  return entries
    .filter((entry) => getDiaryDateId(entry) === dateId)
    .sort((a, b) => b.date - a.date);
};

export const shouldDisplayEntryTime = (entry: Pick<DiaryEntry, 'date' | 'createdAt'>): boolean => {
  if (Number.isFinite(entry.createdAt)) return true;
  const date = new Date(entry.date);
  return date.getHours() !== 0 || date.getMinutes() !== 0;
};
