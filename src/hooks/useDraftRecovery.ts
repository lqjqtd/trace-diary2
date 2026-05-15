import { useState, useEffect, useRef } from 'react';
import { DiaryEntry } from '../types';
import { getDraft, clearDraft, DraftData } from '../api/storage';

const MAX_IMAGES = 9;

interface DraftRecoveryResult {
  content: string;
  mood?: string;
  weather?: string;
  images?: string[];
  tags?: string[];
  templateUsed?: string;
}

interface UseDraftRecoveryOptions {
  diaryId: string;
  existingEntry: DiaryEntry | null | undefined;
  draftOnlyMode: boolean;
  showAlert: (title: string, message?: string, actions?: any[]) => void;
  onRecover: (result: DraftRecoveryResult) => void;
}

export function useDraftRecovery({
  diaryId,
  existingEntry,
  draftOnlyMode,
  showAlert,
  onRecover,
}: UseDraftRecoveryOptions) {
  const [draftChecked, setDraftChecked] = useState(false);
  const onRecoverRef = useRef(onRecover);
  onRecoverRef.current = onRecover;

  useEffect(() => {
    if (draftChecked) return;

    const draft = getDraft();
    if (!draft || draft.diaryId !== diaryId) {
      setDraftChecked(true);
      return;
    }

    const timeDiff = Date.now() - draft.savedAt;
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff >= 24 || !draft.content.trim()) {
      clearDraft();
      setDraftChecked(true);
      return;
    }

    if (draftOnlyMode) {
      onRecoverRef.current({
        content: draft.content,
        mood: draft.mood,
        weather: draft.weather,
        images: draft.images,
        tags: draft.tags,
        templateUsed: draft.templateUsed,
      });
      clearDraft();
      setDraftChecked(true);
      return;
    }

    if (existingEntry) {
      showAlert(
        '发现草稿',
        '检测到同一天的草稿内容，是否合并到当前日记？',
        [
          {
            text: '忽略',
            style: 'cancel',
            onPress: () => {
              clearDraft();
              setDraftChecked(true);
            },
          },
          {
            text: '替换',
            style: 'destructive',
            onPress: () => {
              onRecoverRef.current({
                content: draft.content,
                mood: draft.mood,
                weather: draft.weather,
                images: draft.images,
                tags: draft.tags,
                templateUsed: draft.templateUsed,
              });
              clearDraft();
              setDraftChecked(true);
            },
          },
          {
            text: '合并',
            onPress: () => {
              const mergedContent = `${existingEntry.content}\n\n---\n\n${draft.content}`.trim();
              const mergedTags = Array.from(new Set([...(existingEntry.tags || []), ...(draft.tags || [])]));
              const mergedImages = [...(existingEntry.images || []), ...(draft.images || [])].slice(0, MAX_IMAGES);
              onRecoverRef.current({
                content: mergedContent,
                mood: existingEntry.mood || draft.mood,
                weather: existingEntry.weather || draft.weather,
                images: mergedImages,
                tags: mergedTags,
                templateUsed: existingEntry.templateUsed || draft.templateUsed,
              });
              clearDraft();
              setDraftChecked(true);
            },
          },
        ]
      );
    } else {
      showAlert(
        '发现草稿',
        '是否恢复上次未保存的内容？',
        [
          {
            text: '丢弃',
            style: 'destructive',
            onPress: () => {
              clearDraft();
              setDraftChecked(true);
            },
          },
          {
            text: '恢复',
            onPress: () => {
              onRecoverRef.current({
                content: draft.content,
                mood: draft.mood,
                weather: draft.weather,
                images: draft.images,
                tags: draft.tags,
                templateUsed: draft.templateUsed,
              });
              clearDraft();
              setDraftChecked(true);
            },
          },
        ]
      );
    }
  }, [diaryId, existingEntry, draftChecked, draftOnlyMode, showAlert]);

  return { draftChecked };
}
