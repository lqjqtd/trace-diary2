import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Layout, Typography } from '../constants';
import { LocationInfo } from '../types';
import {
  getCurrentLocation,
  reverseGeocode,
  searchLocations,
  getNearbyPlaces,
} from '../utils/locationUtils';
import { useTheme } from '../context/ThemeProvider';
import { findCustomLocation, saveCustomLocation, getCustomLocations } from '../api/storage';

interface LocationModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: LocationInfo | null) => void;
  initialLocation?: LocationInfo | null;
}

export function LocationModal({
  visible,
  onClose,
  onSelect,
  initialLocation,
}: LocationModalProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationInfo | null>(initialLocation || null);
  const [nearbyPlaces, setNearbyPlaces] = useState<LocationInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationInfo[]>([]);
  const [customLocation, setCustomLocation] = useState('');
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [renamingLocation, setRenamingLocation] = useState<LocationInfo | null>(null);
  const [customLocations, setCustomLocations] = useState<{ id: string; name: string; latitude: number; longitude: number }[]>([]);

  const autoSelectedRef = useRef(false);
  const manuallyClearedRef = useRef(false);

  useEffect(() => {
    setCurrentLocation(initialLocation || null);
    if (visible) {
      const list = getCustomLocations();
      setCustomLocations(list);
    }
  }, [visible, initialLocation]);

  const [locationSource, setLocationSource] = useState<'gps' | 'network' | 'amap' | 'ip' | null>(null);

  const applyCustomName = (loc: LocationInfo): LocationInfo => {
    if (!loc.latitude || !loc.longitude) return loc;
    const custom = findCustomLocation(loc.latitude, loc.longitude);
    if (custom) {
      return { ...loc, name: custom.name };
    }
    return loc;
  };

  const applyCustomNamesToList = (places: LocationInfo[]): LocationInfo[] => {
    return places.map((place) => applyCustomName(place));
  };

  useEffect(() => {
    console.log('[LocationModal] visible:', visible, 'initialLocation:', initialLocation);
    if (visible) {
      autoSelectedRef.current = false;
      manuallyClearedRef.current = false;
      if (!initialLocation) {
        console.log('[LocationModal] 触发自动获取位置');
        fetchCurrentLocation();
      }
    }
  }, [visible]);

  useEffect(() => {
    if (!currentLocation || loading || initialLocation || autoSelectedRef.current || manuallyClearedRef.current) return;

    console.log('[LocationModal] 自动定位成功，准备自动选择:', currentLocation);
    autoSelectedRef.current = true;

    const timer = setTimeout(() => {
      console.log('[LocationModal] 自动选择位置:', currentLocation);
      onSelect(currentLocation);
    }, 500);

    return () => clearTimeout(timer);
  }, [currentLocation, loading, initialLocation]);

  const fetchCurrentLocation = async () => {
    console.log('[LocationModal] 开始 fetchCurrentLocation');
    setLoading(true);
    setErrorMessage(null);
    setLocationSource(null);
    try {
      console.log('[LocationModal] 调用 getCurrentLocation...');
      const result = await getCurrentLocation();
      console.log('[LocationModal] getCurrentLocation 返回:', result);

      if (result.error) {
        console.log('[LocationModal] 显示错误:', result.error);
        setErrorMessage(result.error);
        setLoading(false);
        return;
      }

      const locInfo = result.locationInfo;
      console.log('[LocationModal] locInfo:', locInfo);
      if (locInfo) {
        const namedLoc = applyCustomName(locInfo);
        setLocationSource(result.source);
        setCurrentLocation(namedLoc);
        console.log('[LocationModal] 设置当前位置:', namedLoc, '来源:', result.source);

        if (result.source !== 'ip') {
          console.log('[LocationModal] 获取附近地点...');
          setLoadingNearby(true);
          const nearby = await getNearbyPlaces(
            locInfo.latitude,
            locInfo.longitude
          );
          console.log('[LocationModal] 附近地点数量:', nearby.length);
          setNearbyPlaces(applyCustomNamesToList(nearby));
          setLoadingNearby(false);
        }
      }
      console.log('[LocationModal] fetchCurrentLocation 完成');
    } catch (error) {
      console.error('[LocationModal] fetchCurrentLocation 异常:', error);
      setErrorMessage('获取位置失败，请检查定位权限或网络连接');
    } finally {
      console.log('[LocationModal] 设置 loading(false)');
      setLoading(false);
    }
  };

  // 搜索地点
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    setErrorMessage(null);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoadingSearch(true);
    try {
      const results = await searchLocations(query);
      if (results.length === 0 && query.length >= 2) {
        setErrorMessage('未找到相关地点，请尝试其他关键词');
      }
      setSearchResults(applyCustomNamesToList(results));
    } catch (error) {
      console.error('搜索失败:', error);
      setErrorMessage('搜索失败，请检查网络连接');
    } finally {
      setLoadingSearch(false);
    }
  }, []);

  // 选择地点
  const handleSelect = (location: LocationInfo) => {
    onSelect(location);
    onClose();
  };

  // 重命名位置
  const handleRename = (location: LocationInfo) => {
    setRenamingLocation(location);
    setRenameInput(location.name);
    setShowRenameModal(true);
  };

  // 保存重命名
  const handleSaveRename = () => {
    if (!renamingLocation || !renameInput.trim()) return;
    if (!renamingLocation.latitude || !renamingLocation.longitude) {
      // 无坐标的自定义地点，直接改名返回
      const newLoc = { ...renamingLocation, name: renameInput.trim() };
      setCurrentLocation(newLoc);
      onSelect(newLoc);
      setShowRenameModal(false);
      setRenamingLocation(null);
      return;
    }

    const id = `${renamingLocation.latitude.toFixed(5)}_${renamingLocation.longitude.toFixed(5)}`;
    saveCustomLocation({
      id,
      name: renameInput.trim(),
      latitude: renamingLocation.latitude,
      longitude: renamingLocation.longitude,
    });

    // 刷新自定义列表
    const list = getCustomLocations();
    setCustomLocations(list);

    // 更新当前位置名称
    const newLoc = { ...renamingLocation, name: renameInput.trim() };
    setCurrentLocation(newLoc);

    // 更新附近列表中的名称
    setNearbyPlaces(prev => applyCustomNamesToList(prev));
    setSearchResults(prev => applyCustomNamesToList(prev));

    // 通知父组件
    onSelect(newLoc);

    setShowRenameModal(false);
    setRenamingLocation(null);
  };

  // 清除位置
  const handleClear = () => {
    manuallyClearedRef.current = true;
    onSelect(null);
    onClose();
  };

  // 添加自定义地点
  const handleAddCustom = () => {
    if (!customLocation.trim()) return;
    const locInfo: LocationInfo = {
      name: customLocation.trim(),
      latitude: 0,
      longitude: 0,
    };
    onSelect(locInfo);
    setCustomLocation('');
    onClose();
  };

  const renderNearbyItem = ({ item }: { item: LocationInfo }) => {
    const hasCustom = !!findCustomLocation(item.latitude, item.longitude);
    return (
      <TouchableOpacity
        style={[styles.placeItem, { backgroundColor: colors.inputBackground }]}
        onPress={() => handleSelect(item)}
        onLongPress={() => handleRename(item)}
        activeOpacity={0.7}
      >
        <Feather name="map-pin" size={16} color={colors.textMuted} />
        <Text style={[styles.placeText, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.name}
        </Text>
        {hasCustom && (
          <Feather name="star" size={12} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>位置</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* 当前定位 */}
          <View style={styles.section}>
            {loading ? (
              <View style={[styles.currentLocation, { backgroundColor: colors.inputBackground }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                  正在获取位置...
                </Text>
              </View>
            ) : currentLocation ? (
              <TouchableOpacity
                style={[styles.currentLocation, { backgroundColor: colors.primary + '15' }]}
                onPress={() => handleSelect(currentLocation)}
                onLongPress={() => handleRename(currentLocation)}
                activeOpacity={0.7}
              >
                <Feather
                  name={locationSource === 'ip' ? 'wifi' : 'navigation'}
                  size={18}
                  color={colors.primary}
                />
                <View style={styles.currentLocationText}>
                  <Text style={[styles.currentLocationLabel, { color: colors.primary }]}>
                    {locationSource === 'ip' ? 'IP定位（城市级别）' : '当前位置'}
                  </Text>
                  <Text style={[styles.currentLocationName, { color: colors.textPrimary }]} numberOfLines={2}>
                    {currentLocation.name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRename(currentLocation)}
                  style={styles.editButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather name="edit-2" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.currentLocation, { backgroundColor: colors.inputBackground }]}
                onPress={fetchCurrentLocation}
                activeOpacity={0.7}
              >
                <Feather name="map-pin" size={18} color={colors.textMuted} />
                <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                  无法获取位置，点击重试
                </Text>
              </TouchableOpacity>
            )}

            {/* 错误提示 */}
            {errorMessage && (
              <View style={[styles.errorContainer, { backgroundColor: colors.error + '15' }]}>
                <Feather name="alert-circle" size={14} color={colors.error || '#e74c3c'} />
                <Text style={[styles.errorText, { color: colors.error || '#e74c3c' }]}>
                  {errorMessage}
                </Text>
              </View>
            )}
          </View>

          {/* 附近推荐 */}
          {nearbyPlaces.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                附近推荐
              </Text>
              {loadingNearby ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <FlatList
                  data={nearbyPlaces}
                  renderItem={renderNearbyItem}
                  keyExtractor={(item, index) => `${item.name}-${index}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
              )}
            </View>
          )}

          {/* 搜索 */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              搜索城市/地点
            </Text>
            <View style={[styles.searchContainer, { backgroundColor: colors.inputBackground }]}>
              <Feather name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder="输入城市或地点名称"
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={handleSearch}
                autoCorrect={false}
              />
              {loadingSearch && <ActivityIndicator size="small" color={colors.primary} />}
            </View>
            
            {searchResults.length > 0 && (
              <View style={styles.searchResults}>
                {searchResults.map((item, index) => (
                  <TouchableOpacity
                    key={`${item.name}-${index}`}
                    style={[styles.searchResultItem, { backgroundColor: colors.inputBackground }]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Feather name="map-pin" size={16} color={colors.textMuted} />
                    <Text style={[styles.placeText, { color: colors.textPrimary }]} numberOfLines={2}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* 自定义地点 */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              自定义地点
            </Text>
            <View style={styles.customContainer}>
              <TextInput
                style={[
                  styles.customInput,
                  { backgroundColor: colors.inputBackground, color: colors.textPrimary },
                ]}
                placeholder="老家、公司、旅行地..."
                placeholderTextColor={colors.textMuted}
                value={customLocation}
                onChangeText={setCustomLocation}
              />
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={handleAddCustom}
                disabled={!customLocation.trim()}
              >
                <Feather name="plus" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 清除位置按钮 */}
          {initialLocation && (
            <TouchableOpacity
              style={[styles.clearButton, { backgroundColor: colors.inputBackground }]}
              onPress={handleClear}
            >
              <Feather name="trash-2" size={18} color={colors.error || '#e74c3c'} />
              <Text style={[styles.clearButtonText, { color: colors.error || '#e74c3c' }]}>
                清除位置
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* 重命名弹窗 */}
      <Modal
        visible={showRenameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRenameModal(false)}
      >
        <View style={styles.renameOverlay}>
          <View style={[styles.renameContainer, { backgroundColor: colors.background }]}>
            <Text style={[styles.renameTitle, { color: colors.textPrimary }]}>重命名位置</Text>
            <TextInput
              style={[styles.renameInput, { color: colors.textPrimary, borderColor: colors.divider }]}
              value={renameInput}
              onChangeText={setRenameInput}
              placeholder="输入新名称"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.renameActions}>
              <TouchableOpacity
                style={[styles.renameBtn, { backgroundColor: colors.inputBackground }]}
                onPress={() => {
                  setShowRenameModal(false);
                  setRenamingLocation(null);
                }}
              >
                <Text style={[styles.renameBtnText, { color: colors.textSecondary }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renameBtn, styles.renameBtnPrimary, { backgroundColor: colors.primary }]}
                onPress={handleSaveRename}
              >
                <Text style={styles.renameBtnPrimaryText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: Layout.borderRadius.xl,
    borderTopRightRadius: Layout.borderRadius.xl,
    paddingBottom: Layout.spacing.xl,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Layout.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold as any,
  },
  closeButton: {
    padding: Layout.spacing.xs,
  },
  section: {
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.lg,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Layout.spacing.sm,
    padding: Layout.spacing.sm,
    borderRadius: Layout.borderRadius.sm,
    gap: Layout.spacing.xs,
  },
  errorText: {
    fontSize: Typography.fontSize.xs,
    flex: 1,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    marginBottom: Layout.spacing.sm,
    fontWeight: Typography.fontWeight.medium as any,
  },
  currentLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Layout.spacing.md,
    borderRadius: Layout.borderRadius.md,
    gap: Layout.spacing.sm,
  },
  currentLocationText: {
    flex: 1,
    marginLeft: Layout.spacing.xs,
  },
  currentLocationLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium as any,
  },
  currentLocationName: {
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },
  loadingText: {
    fontSize: Typography.fontSize.sm,
    marginLeft: Layout.spacing.sm,
  },
  separator: {
    width: Layout.spacing.sm,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.md,
    borderRadius: Layout.borderRadius.md,
    gap: Layout.spacing.xs,
    maxWidth: 200,
  },
  placeText: {
    fontSize: Typography.fontSize.sm,
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.borderRadius.md,
    gap: Layout.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    paddingVertical: Layout.spacing.xs,
  },
  searchResults: {
    marginTop: Layout.spacing.sm,
    gap: Layout.spacing.xs,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Layout.spacing.md,
    borderRadius: Layout.borderRadius.md,
    gap: Layout.spacing.sm,
  },
  customContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
  },
  customInput: {
    flex: 1,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.borderRadius.md,
    fontSize: Typography.fontSize.sm,
  },
  addButton: {
    padding: Layout.spacing.sm,
    borderRadius: Layout.borderRadius.md,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Layout.spacing.lg,
    marginTop: Layout.spacing.lg,
    padding: Layout.spacing.md,
    borderRadius: Layout.borderRadius.md,
    gap: Layout.spacing.sm,
  },
  clearButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium as any,
  },
  editButton: {
    padding: Layout.spacing.xs,
    marginLeft: Layout.spacing.xs,
  },
  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Layout.spacing.lg,
  },
  renameContainer: {
    width: '100%',
    borderRadius: Layout.borderRadius.lg,
    padding: Layout.spacing.lg,
    gap: Layout.spacing.md,
  },
  renameTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold as any,
    textAlign: 'center',
  },
  renameInput: {
    borderWidth: 1,
    borderRadius: Layout.borderRadius.md,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    fontSize: Typography.fontSize.base,
  },
  renameActions: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
  },
  renameBtn: {
    flex: 1,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.borderRadius.md,
    alignItems: 'center',
  },
  renameBtnPrimary: {
    marginLeft: 'auto',
  },
  renameBtnText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium as any,
  },
  renameBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium as any,
  },
});
