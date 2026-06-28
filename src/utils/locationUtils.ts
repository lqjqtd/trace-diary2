import * as Location from 'expo-location';
import { LocationInfo } from '../types';

/**
 * 请求定位权限并获取当前位置
 */
export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }
    
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    
    return location;
  } catch (error) {
    console.error('获取位置失败:', error);
    return null;
  }
}

/**
 * 逆地理编码：将经纬度转换为地址名称
 * 使用 Nominatim (OpenStreetMap) 服务
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TraceDiary/1.0',
        },
      }
    );
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (data.error) {
      return null;
    }
    
    // 优先返回 neighborhood/quarter，然后是 suburb，最后是 city
    const address = data.address;
    let locationName = address.neighborhood 
      || address.quarter 
      || address.suburb 
      || address.city_district 
      || address.city 
      || address.town 
      || address.village 
      || address.county;
    
    // 添加区县信息
    if (address.city && address.district && address.city !== address.district) {
      locationName = `${address.city}${address.district}${locationName || ''}`;
    } else if (address.city && address.city !== locationName) {
      locationName = `${address.city}${locationName || ''}`;
    }
    
    return locationName || null;
  } catch (error) {
    console.error('逆地理编码失败:', error);
    return null;
  }
}

/**
 * 搜索地点
 * 使用 Nominatim (OpenStreetMap) 服务
 */
export async function searchLocations(query: string): Promise<LocationInfo[]> {
  if (!query.trim()) {
    return [];
  }
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TraceDiary/1.0',
        },
      }
    );
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      return [];
    }
    
    return data.map((item: any) => ({
      name: item.display_name || query,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
    }));
  } catch (error) {
    console.error('搜索位置失败:', error);
    return [];
  }
}

/**
 * 获取附近的地点推荐
 */
export async function getNearbyPlaces(
  latitude: number,
  longitude: number
): Promise<LocationInfo[]> {
  try {
    // 使用 Nominatim 的搜索功能，搜索附近的地标
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=amenity|building|road&lat=${latitude}&lon=${longitude}&radius=1000&limit=10&addressdetails=1`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TraceDiary/1.0',
        },
      }
    );
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      return [];
    }
    
    // 去重并格式化
    const seen = new Set<string>();
    return data
      .map((item: any) => {
        const name = item.display_name?.split(',')[0] || item.name || '';
        if (seen.has(name)) return null;
        seen.add(name);
        return {
          name,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.error('获取附近地点失败:', error);
    return [];
  }
}
