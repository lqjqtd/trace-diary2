import axios from 'axios';

const WEATHER_CODE_MAP: Record<number, string> = {
  0: '晴', 1: '大部晴朗', 2: '多云', 3: '阴',
  45: '雾', 48: '霜雾',
  51: '小毛毛雨', 53: '中毛毛雨', 55: '大毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  71: '小雪', 73: '中雪', 75: '大雪',
  95: '雷暴', 96: '雷暴伴冰雹',
};

export const getWeatherByCoords = async (lat: number, lon: number) => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Asia/Shanghai`;
  
  const { data } = await axios.get(url);
  const current = data.current;
  
  return {
    temperature: Math.round(current.temperature_2m),
    condition: WEATHER_CODE_MAP[current.weather_code] || '未知',
  };
};