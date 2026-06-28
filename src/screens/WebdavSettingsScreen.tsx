// src/screens/WebdavSettingsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  FlatList,
  Modal,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { format } from 'date-fns';
import webdavService from '../api/webdavService';
import { getLastSyncTime, setLastSyncTime, getAutoSyncEnabled, setAutoSyncEnabled, exportAllData, importDataOverwrite } from '../api/storage';
import { getImageDir } from '../utils/imageStorage';

const WEBDAV_URL_KEY = 'webdav_url';
const WEBDAV_USER_KEY = 'webdav_user';
const WEBDAV_PASS_KEY = 'webdav_pass';

interface BackupInfo {
  fileName: string;
  modifiedTime: number;
}

export default function WebdavSettingsScreen() {
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lastSyncTime, setLastSyncTimeState] = useState<number>(0);
  const [backupList, setBackupList] = useState<BackupInfo[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState(false);

  // 获取 MMKV 数据文件路径
  const getDataFilePath = useCallback(() => {
    // MMKV 的数据存储在特定目录，需要通过 expo-file-system 访问
    // 实际上我们需要获取 MMKV 存储的 JSON 文件路径
    // 这里使用固定路径
    return `${FileSystem.documentDirectory}diary_data.json`;
  }, []);

  // 页面加载时读取配置和同步状态
  useEffect(() => {
    const loadSavedConfig = async () => {
      try {
        const savedUrl = await SecureStore.getItemAsync(WEBDAV_URL_KEY);
        const savedUser = await SecureStore.getItemAsync(WEBDAV_USER_KEY);
        const savedPass = await SecureStore.getItemAsync(WEBDAV_PASS_KEY);

        if (savedUrl) setServerUrl(savedUrl);
        if (savedUser) setUsername(savedUser);
        if (savedPass) setPassword(savedPass);

        // 读取上次同步时间
        const syncTime = getLastSyncTime();
        setLastSyncTimeState(syncTime);

        // 读取自动同步状态
        const autoSync = getAutoSyncEnabled();
        setAutoSyncEnabledState(autoSync);

        // 如果已配置，初始化服务并加载备份列表
        if (savedUrl && savedUser && savedPass) {
          webdavService.initialize(savedUrl, savedUser, savedPass);
          loadBackupList();
        }
      } catch (error) {
        console.error('读取 WebDAV 配置失败:', error);
      }
    };
    loadSavedConfig();
  }, []);

  // 加载备份列表
  const loadBackupList = async () => {
    setIsLoadingBackups(true);
    try {
      const list = await webdavService.getBackupList();
      setBackupList(list);
    } catch (error) {
      console.error('加载备份列表失败:', error);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!serverUrl || !username || !password) {
      Alert.alert('提示', '请填写完整的服务器信息');
      return;
    }

    setIsTesting(true);
    setIsConnected(null);
    try {
      webdavService.initialize(serverUrl, username, password);
      const success = await webdavService.testConnection();
      setIsConnected(success);
      if (success) {
        Alert.alert('成功', 'WebDAV 服务器连接正常！');
        loadBackupList();
      } else {
        Alert.alert('失败', '无法连接到 WebDAV 服务器，请检查配置或网络。');
      }
    } catch (error) {
      setIsConnected(false);
      Alert.alert('错误', '测试连接时发生异常');
    } finally {
      setIsTesting(false);
    }
  };

  // 保存配置
  const handleSaveConfig = async () => {
    if (!serverUrl || !username || !password) {
      Alert.alert('提示', '请填写完整的服务器信息');
      return;
    }

    setIsSaving(true);
    try {
      await SecureStore.setItemAsync(WEBDAV_URL_KEY, serverUrl);
      await SecureStore.setItemAsync(WEBDAV_USER_KEY, username);
      await SecureStore.setItemAsync(WEBDAV_PASS_KEY, password);
      
      webdavService.initialize(serverUrl, username, password);
      
      Alert.alert('成功', 'WebDAV 配置已安全保存！');
    } catch (error) {
      console.error('保存 WebDAV 配置失败:', error);
      Alert.alert('错误', '保存配置时发生异常');
    } finally {
      setIsSaving(false);
    }
  };

  // 手动同步（上传）
  const handleManualSync = async () => {
    if (!serverUrl || !username || !password) {
      Alert.alert('提示', '请先保存 WebDAV 配置');
      return;
    }

    Alert.alert(
      '确认同步',
      '将本地数据备份到云端？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: async () => {
            setIsTesting(true);
            try {
              const imageDir = getImageDir();
              
              // 从 MMKV 导出所有数据
              const exportData = exportAllData();
              const dataJson = JSON.stringify(exportData);
              
              const uploadedFileName = await webdavService.uploadBackup(dataJson, imageDir, true);
              
              const syncTime = Date.now();
              setLastSyncTime(syncTime);
              setLastSyncTimeState(syncTime);
              webdavService.setLastSyncTime(syncTime);
              
              await loadBackupList();
              Alert.alert('成功', `备份已上传: ${uploadedFileName}`);
            } catch (error) {
              console.error('同步失败:', error);
              Alert.alert('失败', '同步失败，请检查控制台日志');
            } finally {
              setIsTesting(false);
            }
          },
        },
      ]
    );
  };

  // 从云端恢复
  const handleRestore = (backup: BackupInfo) => {
    Alert.alert(
      '确认恢复',
      `将从云端备份 "${formatBackupTime(backup.modifiedTime)}" 恢复数据到本地？\n\n此操作将覆盖本地数据，建议先手动备份本地数据。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '继续恢复',
          style: 'destructive',
          onPress: async () => {
            setIsTesting(true);
            try {
              const imageDir = getImageDir();
              
              const result = await webdavService.downloadBackup(imageDir, backup.fileName);
              
              if (result.success) {
                // 导入数据到 MMKV
                const exportData = JSON.parse(result.dataJson);
                importDataOverwrite(exportData);
                
                const syncTime = Date.now();
                setLastSyncTime(syncTime);
                setLastSyncTimeState(syncTime);
                webdavService.setLastSyncTime(syncTime);
                
                Alert.alert('成功', '数据已从云端恢复，请重启应用使数据生效。');
              } else {
                // 根据错误类型显示不同提示
                const errorMessages: Record<string, string> = {
                  'file_not_found': '远程备份文件不存在，请先上传备份。',
                  'network_error': '网络连接失败，请检查网络后重试。',
                  'auth_failed': '认证失败，请检查用户名和密码是否正确。',
                  'unknown': '恢复失败，请检查控制台日志或稍后重试。',
                };
                Alert.alert('恢复失败', errorMessages[result.errorType] || errorMessages['unknown']);
              }
            } catch (error) {
              console.error('恢复失败:', error);
              Alert.alert('失败', '恢复过程中发生异常，请检查控制台日志');
            } finally {
              setIsTesting(false);
            }
          },
        },
      ]
    );
  };

  // 从最新备份恢复
  const handleRestoreLatest = () => {
    if (backupList.length === 0) {
      Alert.alert('提示', '暂无备份可恢复');
      return;
    }
    handleRestore(backupList[0]);
  };

  // 格式化同步时间
  const formatSyncTime = (timestamp: number) => {
    if (!timestamp || timestamp <= 0) return '从未同步';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '从未同步';
    return format(date, 'yyyy-MM-dd HH:mm:ss');
  };

  // 安全格式化备份时间
  const formatBackupTime = (timestamp: number) => {
    if (!timestamp || timestamp <= 0) return '未知时间';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '未知时间';
    return format(date, 'yyyy-MM-dd HH:mm:ss');
  };

  // 切换自动同步
  const handleToggleAutoSync = () => {
    const newValue = !autoSyncEnabled;
    setAutoSyncEnabled(newValue);
    setAutoSyncEnabledState(newValue);
    Alert.alert(
      '自动同步',
      newValue ? '已开启自动同步。保存日记后会自动上传到云端。' : '已关闭自动同步。'
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>☁️ 云同步设置 (WebDAV)</Text>
        <Text style={styles.subtitle}>
          支持坚果云等 WebDAV 服务。{'\n'}
          备份文件将使用带时间戳的名称保存历史版本。
        </Text>

        <View style={styles.syncStatusCard}>
          <View>
            <Text style={styles.syncStatusLabel}>上次同步</Text>
            <Text style={styles.syncStatusTime}>{formatSyncTime(lastSyncTime)}</Text>
          </View>
          <TouchableOpacity 
            style={[
              styles.autoSyncToggle,
              autoSyncEnabled ? styles.autoSyncEnabled : styles.autoSyncDisabled
            ]}
            onPress={handleToggleAutoSync}
          >
            <Text style={styles.autoSyncText}>
              {autoSyncEnabled ? '✓ 自动同步' : '○ 自动同步'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>服务器地址</Text>
          <TextInput
            style={styles.input}
            placeholder="例如: https://dav.jianguoyun.com/dav/"
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>用户名</Text>
          <TextInput
            style={styles.input}
            placeholder="你的 WebDAV 用户名"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>密码 / 应用专用密码</Text>
          <TextInput
            style={styles.input}
            placeholder="你的 WebDAV 密码"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, styles.testButton]} 
          onPress={handleTestConnection}
          disabled={isTesting || isSaving}
        >
          {isTesting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>🔗 测试连接</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.saveButton]} 
          onPress={handleSaveConfig}
          disabled={isTesting || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>💾 保存配置</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>📤 备份与恢复</Text>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#FF9800' }]} 
          onPress={handleManualSync}
          disabled={isTesting || isSaving || !serverUrl}
        >
          {isTesting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>☁️ 立即同步到云端</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#9C27B0' }]} 
          onPress={() => { setShowBackupModal(true); loadBackupList(); }}
          disabled={!serverUrl}
        >
          <Text style={styles.buttonText}>📋 查看备份历史</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#E91E63' }]} 
          onPress={handleRestoreLatest}
          disabled={!serverUrl || backupList.length === 0}
        >
          <Text style={styles.buttonText}>♻️ 从最新备份恢复</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 备份历史弹窗 */}
      <Modal
        visible={showBackupModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBackupModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📋 云端备份历史</Text>
            
            {isLoadingBackups ? (
              <ActivityIndicator size="large" color="#4A90E2" />
            ) : backupList.length === 0 ? (
              <Text style={styles.emptyText}>暂无备份记录</Text>
            ) : (
              <FlatList
                data={backupList}
                keyExtractor={(item) => item.fileName}
                style={styles.backupList}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.backupItem}
                    onPress={() => {
                      setShowBackupModal(false);
                      handleRestore(item);
                    }}
                  >
                    <Text style={styles.backupFileName} numberOfLines={1}>
                      {item.fileName}
                    </Text>
                    <Text style={styles.backupTime}>
                      {formatBackupTime(item.modifiedTime)}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#666' }]} 
              onPress={() => setShowBackupModal(false)}
            >
              <Text style={styles.buttonText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  syncStatusCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncStatusLabel: {
    fontSize: 14,
    color: '#666',
  },
  syncStatusTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  autoSyncToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  autoSyncEnabled: {
    backgroundColor: '#4CAF50',
  },
  autoSyncDisabled: {
    backgroundColor: '#ccc',
  },
  autoSyncText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    color: '#444',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    height: 50,
  },
  testButton: {
    backgroundColor: '#4A90E2',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
    textAlign: 'center',
  },
  backupList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  backupItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backupFileName: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  backupTime: {
    fontSize: 12,
    color: '#999',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginVertical: 20,
  },
});
