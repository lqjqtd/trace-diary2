# 素履（Trace）位置功能开发日志

**日期**：2026-06-29  
**功能模块**：日记位置（定位 + 搜索 + 自定义地点）

---

## 一、背景与问题

### 初始问题
- 使用 `expo-location` 进行 GPS 定位，在国内 Android 手机（红米 Turbo 4 Pro / MIUI）上完全无法工作
- 定位请求全部超时，系统权限使用记录中看不到 APP 的位置记录
- 同类应用（一刻日记、一本日记）定位正常

### 根因分析
- `expo-location` 底层依赖 Google Play Services 的 `FusedLocationProviderClient`
- MIUI 国内版没有 GMS，导致原生定位 API 完全不可用
- 同类应用使用高德/百度等国内定位 SDK，不依赖 GMS

---

## 二、技术方案演进

### 方案 1：IP 定位降级（失败）
- 使用高德地图 IP 定位 API 作为降级方案
- 只能定位到城市级别，精度太差

### 方案 2：多级降级策略（部分成功）
- 依次尝试：网络定位 → 平衡定位 → GPS 高精度 → IP 定位
- 仍然受限于 GMS，全部超时失败

### 方案 3：集成高德定位 SDK（最终方案）
- 集成 `@jindun619/react-native-amap` 原生定位 SDK
- 不依赖 GMS，国内 Android 兼容性好
- 精度可达街道级别（25 米左右）

---

## 三、实现内容

### 3.1 包名变更
- **原包名**：`com.trace.diary`
- **新包名**：`com.trace_suo.diary`
- **原因**：高德 SDK 要求绑定包名，使用与品牌一致的命名

### 3.2 高德定位 SDK 集成

**依赖安装**：
- `@jindun619/react-native-amap` - 高德地图 React Native 封装
- 配置 `app.json` plugins，注入 Android API Key

**定位实现**：
- Android 平台优先使用高德定位 SDK
- iOS 平台继续使用 `expo-location`
- 统一返回格式，上层调用无感知

### 3.3 核心功能

#### 自动定位
- 进入编辑器后自动获取当前位置并填入
- 应用自定义地点名称（如果有）
- 用户手动清除位置后，不再自动填充

#### 位置搜索
- 高德地图 POI 搜索 API
- 支持关键词搜索城市、地点、地址
- 搜索结果应用自定义名称

#### 附近地点
- 定位成功后自动获取附近 10 个地标
- 餐饮、购物、景点等多类型混合
- 列表长按可重命名

#### 自定义地点名称
- 长按任意地点可重命名
- 自定义名称保存在本地 MMKV
- 50 米范围内匹配，下次自动显示自定义名称
- 已自定义的地点显示 ⭐ 星标

#### 位置清除
- 位置弹窗底部「清除位置」按钮
- 清除后保持空白，不会自动重新定位
- 点击「添加位置」可重新手动选择

### 3.4 长按快捷操作

**编辑器顶部位置栏**：
- 点击 → 打开位置弹窗
- 长按 → 弹出附近位置快速选择面板

---

## 四、修改的文件

| 文件 | 改动说明 |
|------|----------|
| `app.json` | 添加 `expo-location` plugin、Android 定位权限、高德 SDK 配置、包名变更 |
| `src/utils/locationUtils.ts` | 高德定位 SDK 集成、IP 定位降级、搜索/逆地理/附近地点 API |
| `src/components/LocationModal.tsx` | 重命名弹窗、编辑按钮、长按重命名、自定义名称优先显示 |
| `src/screens/EditorScreen.tsx` | 自动定位、附近位置长按面板、清除位置标记、自定义名称应用 |
| `src/api/storage.ts` | 自定义地点存储（增删查、距离匹配算法） |
| `src/types/index.ts` | LocationInfo 类型定义 |

---

## 五、关键技术点

### 5.1 自定义地点匹配算法
使用 Haversine 公式计算两点间距离，阈值 50 米：
```typescript
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 地球半径（米）
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

### 5.2 清除位置后的防自动填充
使用 `useRef` 标记用户手动清除状态：
- `locationClearedRef` - EditorScreen 层，防止自动定位 useEffect 重新填充
- `manuallyClearedRef` - LocationModal 层，防止弹窗内自动选择逻辑回填
- 弹窗打开时重置 ref，关闭时保留状态（避免时序问题）

### 5.3 高德 Key 区分
- **Web 服务 Key**：用于搜索、逆地理编码、附近地点、IP 定位（HTTP API）
- **Android SDK Key**：用于原生定位 SDK（需要绑定包名和 SHA1）

---

## 六、高德开放平台配置

### 应用信息
- **包名**：`com.trace_suo.diary`
- **SHA1**：`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
- **Debug 签名**：`android/app/debug.keystore`（密码：android）

### Key 列表
| Key 类型 | 用途 |
|----------|------|
| Web 服务 Key | 搜索、逆地理编码、附近地点、IP 定位 |
| Android SDK Key | 高德定位原生 SDK |

---

## 七、测试结果

### 设备：红米 Turbo 4 Pro（MIUI）
- ✅ 自动定位：成功，精度约 25 米，街道级别
- ✅ 位置搜索：成功，支持关键词搜索
- ✅ 附近地点：成功，返回 10 个周边地标
- ✅ 自定义名称：成功，重命名后下次自动显示
- ✅ 清除位置：成功，清除后不再自动填充
- ✅ 长按选择附近位置：成功，快速切换地点

---

## 八、后续优化方向

1. **设置页管理自定义地点**：查看、编辑、删除所有已保存的自定义地点
2. **定位精度选择**：用户可选择高精度 / 低功耗 / 仅网络模式
3. **定位频率优化**：首次定位后缓存一段时间，减少重复请求
4. **iOS 验证**：确认 iOS 平台 `expo-location` 正常工作
5. **导出/导入包含自定义地点**：ZIP 备份中包含自定义地点数据
