import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef } from 'react';
import { DiaryEntry, DiaryAction, ExportData } from '../types';
import {
  getAllEntries,
  saveAllEntries,
  saveEntry as saveEntryToStorage,
  deleteEntry as deleteEntryFromStorage,
  importDataOverwrite,
  importDataMerge,
  exportAllData,
  getAutoSyncEnabled,
  setLastSyncTime,
} from '../api/storage';
import { getEntriesForDate } from '../utils/diaryIdentity';
import { deleteImages } from '../utils/imageStorage';
import webdavService from '../api/webdavService';
import * as SecureStore from 'expo-secure-store';
import { getImageDir } from '../utils/imageStorage';

const WEBDAV_URL_KEY = 'webdav_url';
const WEBDAV_USER_KEY = 'webdav_user';
const WEBDAV_PASS_KEY = 'webdav_pass';

// 日记状态接口
interface DiaryState {
  entries: DiaryEntry[];
  isLoading: boolean;
}

// Context 接口
interface DiaryContextType {
  state: DiaryState;
  addEntry: (entry: DiaryEntry) => void;
  updateEntry: (entry: DiaryEntry) => void;
  deleteEntry: (id: string) => Promise<void>;
  getEntryById: (id: string) => DiaryEntry | undefined;
  getEntriesByDateRange: (start: Date, end: Date) => DiaryEntry[];
  getTodayEntry: () => DiaryEntry | undefined;
  getThisDayLastYearEntries: () => DiaryEntry[];
  importEntries: (data: ExportData, mode: 'merge' | 'overwrite') => void;
  exportEntries: () => ExportData;
  refreshEntries: () => void;
  markPendingSync: () => void;
  markSaveAndExit: () => void;
}

// 初始状态
const initialState: DiaryState = {
  entries: [],
  isLoading: true,
};

// Reducer
function diaryReducer(state: DiaryState, action: DiaryAction): DiaryState {
  switch (action.type) {
    case 'SET_ENTRIES':
      return { ...state, entries: action.payload, isLoading: false };

    case 'ADD_ENTRY': {
      const existingIndex = state.entries.findIndex(e => e.id === action.payload.id);
      if (existingIndex >= 0) {
        const updatedEntries = [...state.entries];
        updatedEntries[existingIndex] = action.payload;
        return { ...state, entries: updatedEntries };
      }
      const newEntries = [...state.entries, action.payload];
      newEntries.sort((a, b) => b.date - a.date);
      return { ...state, entries: newEntries };
    }

    case 'UPDATE_ENTRY': {
      const updatedEntries = state.entries.map((entry) =>
        entry.id === action.payload.id ? action.payload : entry
      );
      return { ...state, entries: updatedEntries };
    }

    case 'DELETE_ENTRY': {
      const filteredEntries = state.entries.filter((entry) => entry.id !== action.payload);
      return { ...state, entries: filteredEntries };
    }

    case 'IMPORT_ENTRIES': {
      if (action.payload.mode === 'overwrite') {
        return { ...state, entries: action.payload.entries };
      } else {
        const existingIds = new Set(state.entries.map((e) => e.id));
        const newEntries = action.payload.entries.filter((e) => !existingIds.has(e.id));
        const mergedEntries = [...state.entries, ...newEntries];
        mergedEntries.sort((a, b) => b.date - a.date);
        return { ...state, entries: mergedEntries };
      }
    }

    default:
      return state;
  }
}

// 创建 Context
const DiaryContext = createContext<DiaryContextType | undefined>(undefined);

// Provider 组件
export function DiaryProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(diaryReducer, initialState);
  
  // 待同步数据引用
  const pendingSyncRef = useRef<{ dataJson: string; imageDir: string } | null>(null);
  // 是否正在同步
  const isSyncingRef = useRef<boolean>(false);

  // 初始化 WebDAV 并加载数据
  useEffect(() => {
    const entries = getAllEntries();
    dispatch({ type: 'SET_ENTRIES', payload: entries });

    // 初始化 WebDAV 客户端
    const initWebDAV = async () => {
      try {
        const savedUrl = await SecureStore.getItemAsync(WEBDAV_URL_KEY);
        const savedUser = await SecureStore.getItemAsync(WEBDAV_USER_KEY);
        const savedPass = await SecureStore.getItemAsync(WEBDAV_PASS_KEY);
        
        if (savedUrl && savedUser && savedPass) {
          webdavService.initialize(savedUrl, savedUser, savedPass);
          console.log('WebDAV 客户端已初始化');
        }
      } catch (error) {
        console.error('初始化 WebDAV 失败:', error);
      }
    };
    initWebDAV();
  }, []);

  // 执行待同步操作
  const executePendingSync = useCallback(async () => {
    if (!pendingSyncRef.current) {
      return;
    }
    if (isSyncingRef.current) {
      return;
    }
    
    if (!getAutoSyncEnabled()) {
      pendingSyncRef.current = null;
      return;
    }
    
    isSyncingRef.current = true;
    
    // 30秒超时
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('同步超时')), 30000);
    });
    
    try {
      const { dataJson, imageDir } = pendingSyncRef.current;
      const result = await Promise.race([
        webdavService.autoSyncWithData(dataJson, imageDir),
        timeoutPromise
      ]) as string | null;
      
      if (result) {
        setLastSyncTime(Date.now());
      }
    } catch (error) {
      console.error('自动同步失败:', error);
    } finally {
      isSyncingRef.current = false;
      pendingSyncRef.current = null;
    }
  }, []);

  // 标记待同步数据并立即开始同步
  const markPendingSync = useCallback(() => {
    const data = exportAllData();
    const dataJson = JSON.stringify(data);
    const imageDir = getImageDir();
    pendingSyncRef.current = { dataJson, imageDir };
    // 立即开始同步
    executePendingSync();
  }, [executePendingSync]);

  // 标记"保存并退出"（目前用于标记，但不用于触发同步）
  const markSaveAndExit = useCallback(() => {
    // 占位
  }, []);

  // 移除 AppState 监听
  // 注：由于 Android 后台会挂起 JS thread，后台触发同步不可靠
  // 目前只在点击保存时立即同步
  useEffect(() => {
    // 占位 effect，避免其他代码引用
  }, []);

  // 添加日记条目
  const addEntry = useCallback((entry: DiaryEntry) => {
    saveEntryToStorage(entry);
    dispatch({ type: 'ADD_ENTRY', payload: entry });
  }, []);

  // 更新日记条目
  const updateEntry = useCallback((entry: DiaryEntry) => {
    saveEntryToStorage(entry);
    dispatch({ type: 'UPDATE_ENTRY', payload: entry });
  }, []);

  // 删除日记条目
  const entriesRef = React.useRef(state.entries);
  entriesRef.current = state.entries;

  const deleteEntry = useCallback(async (id: string) => {
    const entry = entriesRef.current.find(e => e.id === id);
    if (entry?.images && entry.images.length > 0) {
      await deleteImages(entry.images);
    }
    deleteEntryFromStorage(id);
    dispatch({ type: 'DELETE_ENTRY', payload: id });
  }, []);

  // 通过 ID 获取日记
  const getEntryById = useCallback(
    (id: string) => {
      return state.entries.find((entry) => entry.id === id);
    },
    [state.entries]
  );

  // 获取日期范围内的日记
  const getEntriesByDateRange = useCallback(
    (start: Date, end: Date) => {
      return state.entries.filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= start && entryDate <= end;
      });
    },
    [state.entries]
  );

  // 获取今天的日记
  const getTodayEntry = useCallback(() => {
    return getEntriesForDate(state.entries, new Date())[0];
  }, [state.entries]);

  // 获取"那年今日"的日记
  const getThisDayLastYearEntries = useCallback(() => {
    const today = new Date();
    return state.entries.filter((entry) => {
      const entryDate = new Date(entry.date);
      return (
        entryDate.getMonth() === today.getMonth() &&
        entryDate.getDate() === today.getDate() &&
        entryDate.getFullYear() !== today.getFullYear()
      );
    });
  }, [state.entries]);

  // 导入日记
  const importEntries = useCallback((data: ExportData, mode: 'merge' | 'overwrite') => {
    if (mode === 'overwrite') {
      importDataOverwrite(data);
    } else {
      importDataMerge(data);
    }
    dispatch({ type: 'IMPORT_ENTRIES', payload: { entries: data.entries, mode } });
  }, []);

  // 导出日记
  const exportEntries = useCallback(() => {
    return exportAllData();
  }, []);

  // 刷新数据
  const refreshEntries = useCallback(() => {
    const entries = getAllEntries();
    dispatch({ type: 'SET_ENTRIES', payload: entries });
  }, []);

  const value: DiaryContextType = useMemo(() => ({
    state,
    addEntry,
    updateEntry,
    deleteEntry,
    getEntryById,
    getEntriesByDateRange,
    getTodayEntry,
    getThisDayLastYearEntries,
    importEntries,
    exportEntries,
    refreshEntries,
    markPendingSync,
    markSaveAndExit,
  }), [state, addEntry, updateEntry, deleteEntry, getEntryById, getEntriesByDateRange, getTodayEntry, getThisDayLastYearEntries, importEntries, exportEntries, refreshEntries, markPendingSync, markSaveAndExit]);

  return <DiaryContext.Provider value={value}>{children}</DiaryContext.Provider>;
}

// 自定义 Hook
export function useDiary() {
  const context = useContext(DiaryContext);
  if (!context) {
    throw new Error('useDiary must be used within a DiaryProvider');
  }
  return context;
}

export default DiaryProvider;
