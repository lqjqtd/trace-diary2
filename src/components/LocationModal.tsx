import React, { useState, useEffect, useCallback } from 'react';
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

  // 自动获取位置
  useEffect(() => {
    if (visible && !initialLocation) {
      fetchCurrentLocation();
    }
  }, [visible]);

  const fetchCurrentLocation = async () => {
    setLoading(true);
    try {
      const location = await getCurrentLocation();
      if (location) {
        const name = await reverseGeocode(
          location.coords.latitude,
          location.coords.longitude
        );
        if (name) {
          const locInfo: LocationInfo = {
            name,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setCurrentLocation(locInfo);
          
          // 获取附近地点
          setLoadingNearby(true);
          const nearby = await getNearbyPlaces(
            location.coords.latitude,
            location.coords.longitude
          );
          setNearbyPlaces(nearby);
          setLoadingNearby(false);
        }
      }
    } catch (error) {
      console.error('获取位置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 搜索地点
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setLoadingSearch(true);
    try {
      const results = await searchLocations(query);
      setSearchResults(results);
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setLoadingSearch(false);
    }
  }, []);

  // 选择地点
  const handleSelect = (location: LocationInfo) => {
    onSelect(location);
    onClose();
  };

  // 清除位置
  const handleClear = () => {
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

  const renderNearbyItem = ({ item }: { item: LocationInfo }) => (
    <TouchableOpacity
      style={[styles.placeItem, { backgroundColor: colors.inputBackground }]}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <Feather name="map-pin" size={16} color={colors.textMuted} />
      <Text style={[styles.placeText, { color: colors.textPrimary }]} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

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
                activeOpacity={0.7}
              >
                <Feather name="navigation" size={18} color={colors.primary} />
                <View style={styles.currentLocationText}>
                  <Text style={[styles.currentLocationLabel, { color: colors.primary }]}>
                    当前定位
                  </Text>
                  <Text style={[styles.currentLocationName, { color: colors.textPrimary }]} numberOfLines={2}>
                    {currentLocation.name}
                  </Text>
                </View>
                <Feather name="check" size={18} color={colors.primary} />
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
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold as any,
  },
  closeButton: {
    padding: Layout.spacing.xs,
  },
  section: {
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.sizes.sm,
    marginBottom: Layout.spacing.sm,
    fontWeight: Typography.weights.medium as any,
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
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium as any,
  },
  currentLocationName: {
    fontSize: Typography.sizes.sm,
    marginTop: 2,
  },
  loadingText: {
    fontSize: Typography.sizes.sm,
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
    fontSize: Typography.sizes.sm,
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
    fontSize: Typography.sizes.sm,
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
    fontSize: Typography.sizes.sm,
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
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium as any,
  },
});
