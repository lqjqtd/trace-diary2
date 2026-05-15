import { useState, useCallback, useRef } from 'react';

export interface HistoryState {
  content: string;
  images: string[];
}

const MAX_HISTORY = 50;

export function useEditorHistory(initialContent: string, initialImages: string[]) {
  const [history, setHistory] = useState<HistoryState[]>([{ content: initialContent, images: initialImages }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const historyIndexRef = useRef(historyIndex);
  historyIndexRef.current = historyIndex;

  const historyRef = useRef(history);
  historyRef.current = history;

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const saveToHistory = useCallback((newContent: string, newImages: string[]) => {
    if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
    historyTimeoutRef.current = setTimeout(() => {
      const currentIndex = historyIndexRef.current;
      setHistory((prev) => {
        const newHistory = prev.slice(0, currentIndex + 1);
        newHistory.push({ content: newContent, images: newImages });
        if (newHistory.length > MAX_HISTORY) newHistory.shift();
        return newHistory;
      });
      setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
    }, 500);
  }, []);

  const undo = useCallback((): HistoryState | null => {
    const currentHistory = historyRef.current;
    const currentIndex = historyIndexRef.current;
    if (currentIndex <= 0) return null;
    const newIndex = currentIndex - 1;
    setHistoryIndex(newIndex);
    return currentHistory[newIndex];
  }, []);

  const redo = useCallback((): HistoryState | null => {
    const currentHistory = historyRef.current;
    const currentIndex = historyIndexRef.current;
    if (currentIndex >= currentHistory.length - 1) return null;
    const newIndex = currentIndex + 1;
    setHistoryIndex(newIndex);
    return currentHistory[newIndex];
  }, []);

  const resetHistory = useCallback((content: string, images: string[]) => {
    setHistory([{ content, images }]);
    setHistoryIndex(0);
  }, []);

  return {
    canUndo,
    canRedo,
    saveToHistory,
    undo,
    redo,
    resetHistory,
  };
}
