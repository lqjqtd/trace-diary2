import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { LocationInfo } from '../types';

// 高德地图 Web API Key（用于搜索、逆地理编码、IP定位等 Web 服务）
// 申请地址：https://console.amap.com/dev/key/app
const GAODE_WEB_API_KEY: string = '0ac2a3a003e49db5c23cd69bc99cfca2';

// 高德 Android 定位 SDK Key（仅 Android 原生定位使用）
const GAODE_ANDROID_KEY: string = 'b6207b5b2f71af9ed17f2394888ba571';

// 请求超时时间（毫秒）
const REQUEST_TIMEOUT = 10000;

// 高德定位 SDK（仅 Android，iOS 用 expo-location）
let AMapGeolocation: any = null;
let amapInitialized = false;

if (Platform.OS === 'android') {
  try {
    const amapModule = require('@heytea/react-native-amap-geolocation');
    AMapGeolocation = amapModule.default;
  } catch (e) {
    console.warn('[高德定位] 模块加载失败:', e);
  }
}

async function initAMap() {
  if (Platform.OS !== 'android' || !AMapGeolocation || amapInitialized) {
    return;
  }

  try {
    console.log('[高德定位] 初始化 SDK...');
    await AMapGeolocation.init(GAODE_ANDROID_KEY);
    AMapGeolocation.setOnceLocation(true);
    AMapGeolocation.setNeedAddress(true);
    AMapGeolocation.setLocationMode('Hight_Accuracy');
    AMapGeolocation.setHttpTimeout(10000);
    amapInitialized = true;
    console.log('[高德定位] 初始化成功');
  } catch (e) {
    console.error('[高德定位] 初始化失败:', e);
  }
}

/**
 * 带超时的 fetch 请求
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = REQUEST_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 高德 IP 定位（GPS 失败时的降级方案）
 * 返回城市级别精度的位置
 */
export async function getLocationByIp(): Promise<LocationInfo | null> {
  if (GAODE_WEB_API_KEY === 'YOUR_GAODE_WEB_API_KEY') {
    console.warn('[IP定位] 高德 API Key 未配置');
    return null;
  }

  try {
    console.log('[IP定位] 开始IP定位...');
    const response = await fetchWithTimeout(
      `https://restapi.amap.com/v3/ip?key=${GAODE_WEB_API_KEY}`
    );

    if (!response.ok) {
      console.error('[IP定位] HTTP请求失败:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('[IP定位] 返回数据:', data);

    if (data.status !== '1' || !data.rectangle) {
      console.error('[IP定位] 定位失败:', data.info);
      return null;
    }

    // rectangle 格式: "经度1,纬度1;经度2,纬度2"（西南角和东北角）
    const rectangle = data.rectangle;
    const points = rectangle.split(';');
    const [lng1, lat1] = points[0].split(',');
    const [lng2, lat2] = points[1].split(',');

    // 取中心点
    const longitude = (parseFloat(lng1) + parseFloat(lng2)) / 2;
    const latitude = (parseFloat(lat1) + parseFloat(lat2)) / 2;

    // 组合地址名称
    let name = '';
    if (data.province) name += data.province;
    if (data.city && data.city !== data.province) name += data.city;
    if (data.adcode && !name) name = data.adcode;

    console.log('[IP定位] 成功:', name, latitude, longitude);

    return {
      name: name || '当前位置（IP定位）',
      latitude,
      longitude,
    };
  } catch (error) {
    console.error('[IP定位] 失败:', error);
    return null;
  }
}

/**
 * 请求定位权限并获取当前位置
 * Android: 使用高德定位 SDK
 * iOS: 使用 expo-location
 * 失败时降级到 IP 定位
 */
export async function getCurrentLocation(): Promise<{
  location: any;
  locationInfo: LocationInfo | null;
  source: 'gps' | 'network' | 'amap' | 'ip' | null;
  error: string | null;
}> {
  try {
    console.log('[定位] 开始获取位置...');

    // 检查定位服务是否开启
    console.log('[定位] 检查定位服务状态...');
    const isLocationEnabled = await Location.hasServicesEnabledAsync();
    console.log('[定位] 定位服务状态:', isLocationEnabled);

    // 检查权限状态
    console.log('[定位] 检查权限状态...');
    const { status: currentStatus } = await Location.getForegroundPermissionsAsync();
    console.log('[定位] 当前权限状态:', currentStatus);

    // 如果权限没有授予，请求权限
    let status = currentStatus;
    if (currentStatus !== 'granted') {
      console.log('[定位] 请求定位权限...');
      const result = await Location.requestForegroundPermissionsAsync();
      status = result.status;
      console.log('[定位] 权限请求结果:', status);
    }

    if (status !== 'granted' || !isLocationEnabled) {
      // 没有权限或服务，尝试 IP 定位
      console.log('[定位] 权限或服务不可用，尝试IP定位...');
      const ipLocation = await getLocationByIp();
      if (ipLocation) {
        return { location: null, locationInfo: ipLocation, source: 'ip', error: null };
      }
      return {
        location: null,
        locationInfo: null,
        source: null,
        error: '请开启定位服务并授予权限',
      };
    }

    // Android 平台使用高德定位 SDK
    if (Platform.OS === 'android' && AMapGeolocation) {
      console.log('[定位] Android 平台，使用高德定位 SDK...');
      await initAMap();

      try {
        console.log('[高德定位] 开始获取位置...');
        const result = await AMapGeolocation.getCurrentLocation();
        console.log('[高德定位] 返回结果:', result);

        if (result && result.errorCode === 0 && result.latitude && result.longitude) {
          // 定位成功
          console.log('[高德定位] 成功:', result.latitude, result.longitude, result.address);

          // 构建位置名称
          let name = result.description || result.poiName || '';
          if (!name) {
            if (result.district) name += result.district;
            if (result.street) name += result.street;
            if (result.streetNum) name += result.streetNum;
          }
          if (!name && result.address) {
            name = result.address;
          }
          if (!name) {
            name = `位置(${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)})`;
          }

          const locationInfo: LocationInfo = {
            name,
            latitude: result.latitude,
            longitude: result.longitude,
          };

          // 判断来源类型
          const source = result.locationType === 1 ? 'gps' : 'network';

          return { location: result, locationInfo, source, error: null };
        } else {
          console.error('[高德定位] 失败:', result?.errorCode, result?.errorInfo);
        }
      } catch (e: any) {
        console.error('[高德定位] 异常:', e);
      }
    }

    // iOS 或高德失败，使用 expo-location
    console.log('[定位] 使用 expo-location...');

    // 策略1：优先尝试低精度（网络定位，国内安卓兼容性好）
    console.log('[定位] 策略1：尝试网络定位（Low精度）...');
    try {
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('网络定位超时')), 8000);
      });

      const location = await Promise.race([locationPromise, timeoutPromise]);
      console.log('[定位] 网络定位成功:', location.coords);

      const accuracy = location.coords.accuracy || 9999;
      console.log('[定位] 网络定位精度:', accuracy, '米');

      if (accuracy <= 200) {
        const name = await reverseGeocode(location.coords.latitude, location.coords.longitude);
        const locationInfo: LocationInfo = {
          name: name || `位置(${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)})`,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        return { location, locationInfo, source: 'network', error: null };
      }

      console.log('[定位] 网络定位精度不足，继续尝试GPS...');
    } catch (networkError: any) {
      console.warn('[定位] 网络定位失败:', networkError.message);
    }

    // 策略2：尝试 Balanced 精度
    console.log('[定位] 策略2：尝试平衡精度定位...');
    try {
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('平衡定位超时')), 10000);
      });

      const location = await Promise.race([locationPromise, timeoutPromise]);
      console.log('[定位] 平衡定位成功:', location.coords);

      const name = await reverseGeocode(location.coords.latitude, location.coords.longitude);
      const locationInfo: LocationInfo = {
        name: name || `位置(${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)})`,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      return { location, locationInfo, source: 'gps', error: null };
    } catch (balancedError: any) {
      console.warn('[定位] 平衡定位失败:', balancedError.message);
    }

    // 策略3：尝试 Highest 精度
    console.log('[定位] 策略3：尝试高精度GPS定位...');
    try {
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('GPS定位超时')), 15000);
      });

      const location = await Promise.race([locationPromise, timeoutPromise]);
      console.log('[定位] GPS高精度定位成功:', location.coords);

      const name = await reverseGeocode(location.coords.latitude, location.coords.longitude);
      const locationInfo: LocationInfo = {
        name: name || `位置(${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)})`,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      return { location, locationInfo, source: 'gps', error: null };
    } catch (gpsError: any) {
      console.warn('[定位] GPS高精度定位失败:', gpsError.message);
    }

    // 所有原生定位都失败，降级到 IP 定位
    console.log('[定位] 所有原生定位都失败，降级到IP定位...');
    const ipLocation = await getLocationByIp();
    if (ipLocation) {
      console.log('[定位] IP定位成功:', ipLocation);
      return { location: null, locationInfo: ipLocation, source: 'ip', error: null };
    }

    // 都失败了
    console.error('[定位] 所有定位方式都失败了');
    return {
      location: null,
      locationInfo: null,
      source: null,
      error: '定位失败，请检查网络连接',
    };
  } catch (error: any) {
    console.error('[定位] 异常:', error);
    return {
      location: null,
      locationInfo: null,
      source: null,
      error: `定位失败: ${error.message || '未知错误'}`,
    };
  }
}

/**
 * 逆地理编码：将经纬度转换为地址名称
 * 使用高德地图 Web API
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  if (GAODE_WEB_API_KEY === 'YOUR_GAODE_WEB_API_KEY') {
    console.warn('高德 API Key 未配置');
    return null;
  }

  try {
    const response = await fetchWithTimeout(
      `https://restapi.amap.com/v3/geocode/regeo?key=${GAODE_WEB_API_KEY}&location=${longitude},${latitude}&extensions=base`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.status !== '1' || !data.regeocode) {
      return null;
    }

    const addressComponent = data.regeocode.addressComponent;
    const formattedAddress = data.regeocode.formatted_address;

    // 优先返回结构化地址中的区/县 + 街道信息
    let locationName = '';

    if (addressComponent.district) {
      locationName += addressComponent.district;
    }

    if (addressComponent.streetNumber?.street) {
      locationName += addressComponent.streetNumber.street;
    }

    if (addressComponent.township) {
      locationName = addressComponent.township + locationName;
    }

    return locationName || formattedAddress || null;
  } catch (error) {
    console.error('逆地理编码失败:', error);
    return null;
  }
}

/**
 * 搜索地点
 * 使用高德地图 Web API
 */
export async function searchLocations(query: string): Promise<LocationInfo[]> {
  if (!query.trim()) {
    return [];
  }

  if (GAODE_WEB_API_KEY === 'YOUR_GAODE_WEB_API_KEY') {
    console.warn('高德 API Key 未配置');
    return [];
  }

  try {
    const response = await fetchWithTimeout(
      `https://restapi.amap.com/v3/place/text?key=${GAODE_WEB_API_KEY}&keywords=${encodeURIComponent(query)}&city=全国&offset=5&extensions=base`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (data.status !== '1' || !data.pois) {
      return [];
    }

    return data.pois.map((item: any) => ({
      name: item.name || query,
      latitude: parseFloat(item.location?.split(',')[1] || '0'),
      longitude: parseFloat(item.location?.split(',')[0] || '0'),
    })).filter((item: LocationInfo) => item.latitude !== 0 && item.longitude !== 0);
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
  if (GAODE_WEB_API_KEY === 'YOUR_GAODE_WEB_API_KEY') {
    console.warn('高德 API Key 未配置');
    return [];
  }

  try {
    // 搜索附近的地标（餐饮、购物、景点等）
    const types = '餐饮服务|购物服务|生活服务|风景名胜|科教文化服务|交通设施服务';
    const response = await fetchWithTimeout(
      `https://restapi.amap.com/v3/place/around?key=${GAODE_WEB_API_KEY}&location=${longitude},${latitude}&types=${types}&radius=1000&offset=10&extensions=base`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (data.status !== '1' || !data.pois) {
      return [];
    }

    // 去重并格式化
    const seen = new Set<string>();
    return data.pois
      .map((item: any) => {
        const name = item.name || '';
        if (seen.has(name)) return null;
        seen.add(name);
        return {
          name,
          latitude: parseFloat(item.location?.split(',')[1] || '0'),
          longitude: parseFloat(item.location?.split(',')[0] || '0'),
        };
      })
      .filter((item: LocationInfo | null) => item !== null && item.latitude !== 0);
  } catch (error) {
    console.error('获取附近地点失败:', error);
    return [];
  }
}

// ============ 天气相关 ============

export interface WeatherInfo {
  weather: string;
  temperature: number;
  city: string;
}

const WEATHER_MAP: Record<string, string> = {
  '晴': 'sunny',
  '多云': 'cloudy',
  '阴': 'overcast',
  '阵雨': 'rainy',
  '雷阵雨': 'thunderstorm',
  '雷阵雨并伴有冰雹': 'thunderstorm',
  '小雨': 'rainy',
  '中雨': 'rainy',
  '大雨': 'rainy',
  '暴雨': 'rainy',
  '大暴雨': 'rainy',
  '特大暴雨': 'rainy',
  '冻雨': 'rainy',
  '小雪': 'snowy',
  '中雪': 'snowy',
  '大雪': 'snowy',
  '暴雪': 'snowy',
  '雨夹雪': 'snowy',
  '阵雪': 'snowy',
  '雾': 'foggy',
  '冻雾': 'foggy',
  '霾': 'hazy',
  '浮尘': 'sandstorm',
  '扬沙': 'sandstorm',
  '沙尘暴': 'sandstorm',
  '强沙尘暴': 'sandstorm',
  '大风': 'windy',
  '飓风': 'windy',
  '龙卷风': 'windy',
  '热带风暴': 'thunderstorm',
};

function mapWeather(weatherText: string): string {
  if (!weatherText) return 'sunny';
  if (WEATHER_MAP[weatherText]) {
    return WEATHER_MAP[weatherText];
  }
  // 模糊匹配
  if (weatherText.includes('晴')) return 'sunny';
  if (weatherText.includes('雷')) return 'thunderstorm';
  if (weatherText.includes('雪')) return 'snowy';
  if (weatherText.includes('雨')) return 'rainy';
  if (weatherText.includes('阴')) return 'overcast';
  if (weatherText.includes('云')) return 'cloudy';
  if (weatherText.includes('雾')) return 'foggy';
  if (weatherText.includes('霾')) return 'hazy';
  if (weatherText.includes('沙') || weatherText.includes('尘')) return 'sandstorm';
  if (weatherText.includes('风')) return 'windy';
  return 'sunny';
}

/**
 * 根据城市编码获取实时天气
 * @param adcode 城市编码（如 110101）
 */
export async function getWeatherByAdcode(adcode: string): Promise<WeatherInfo | null> {
  if (GAODE_WEB_API_KEY === 'YOUR_GAODE_WEB_API_KEY' || !adcode) {
    return null;
  }

  try {
    const response = await fetchWithTimeout(
      `https://restapi.amap.com/v3/weather/weatherInfo?key=${GAODE_WEB_API_KEY}&city=${adcode}&extensions=base`
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== '1' || !data.lives || data.lives.length === 0) return null;

    const live = data.lives[0];
    return {
      weather: mapWeather(live.weather),
      temperature: parseInt(live.temperature, 10) || 0,
      city: live.city || '',
    };
  } catch (error) {
    console.error('[天气] 获取失败:', error);
    return null;
  }
}

/**
 * 根据经纬度获取实时天气（先逆地理编码拿城市编码）
 */
export async function getWeatherByLocation(
  latitude: number,
  longitude: number
): Promise<WeatherInfo | null> {
  if (GAODE_WEB_API_KEY === 'YOUR_GAODE_WEB_API_KEY') {
    return null;
  }

  try {
    const response = await fetchWithTimeout(
      `https://restapi.amap.com/v3/geocode/regeo?key=${GAODE_WEB_API_KEY}&location=${longitude},${latitude}&extensions=base`
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== '1' || !data.regeocode?.addressComponent?.adcode) return null;

    const adcode = data.regeocode.addressComponent.adcode;
    return await getWeatherByAdcode(adcode);
  } catch (error) {
    console.error('[天气] 通过经纬度获取失败:', error);
    return null;
  }
}
