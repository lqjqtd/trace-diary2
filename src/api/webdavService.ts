// src/api/webdavService.ts
import { createClient, Client } from 'webdav';
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { format } from 'date-fns';

const REMOTE_FOLDER_NAME = '素履日记备份';

// ArrayBuffer 转 Base64 字符串
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Blob 转 ArrayBuffer (React Native 兼容)
const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader did not return ArrayBuffer'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
};

interface BackupInfo {
  fileName: string;
  modifiedTime: number;
}

// 下载结果类型
export type DownloadResult = 
  | { success: true; dataJson: string }
  | { success: false; errorType: 'file_not_found' }
  | { success: false; errorType: 'network_error' }
  | { success: false; errorType: 'auth_failed' }
  | { success: false; errorType: 'unknown' };

class WebDavService {
  private client: Client | null = null;
  private lastSyncTime: number = 0;
  private remoteURL: string = '';
  private username: string = '';
  private password: string = '';

  // 获取上次同步时间
  getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  // 设置上次同步时间
  setLastSyncTime(time: number): void {
    this.lastSyncTime = time;
  }

  // 1. 初始化客户端
  initialize(remoteURL: string, username: string, password: string) {
    this.remoteURL = remoteURL;
    this.username = username;
    this.password = password;
    this.client = createClient(remoteURL, {
      username,
      password,
    });
  }

  // 2. 检查连接是否有效
  async testConnection(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.getDirectoryContents('/');
      return true;
    } catch (error) {
      console.error('WebDAV 连接失败:', error);
      return false;
    }
  }

  // 确保远程备份文件夹存在
  private async ensureRemoteFolderExists() {
    if (!this.client) throw new Error('WebDAV 客户端未初始化');
    const folderPath = `/${REMOTE_FOLDER_NAME}`;
    try {
      await this.client.getDirectoryContents(folderPath);
    } catch (error: any) {
      if (error.status === 404) {
        console.log('远程备份文件夹不存在，正在创建...');
        await this.client.createDirectory(folderPath);
      } else {
        throw error;
      }
    }
  }

  // 生成带时间戳的备份文件名
  private generateBackupFileName(): string {
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    return `sulv_backup_${timestamp}.zip`;
  }

  // 3. 将本地数据打包并上传（带时间戳的备份）
  async uploadBackup(dataJson: string, localImagesDir: string, useTimestamp: boolean = true): Promise<string> {
    if (!this.client) throw new Error('WebDAV 客户端未初始化');
    await this.ensureRemoteFolderExists();

    const zip = new JSZip();
    
    // 直接使用传入的 JSON 数据
    zip.file('data.json', dataJson);

    // 读取图片文件夹
    try {
      const files = await FileSystem.readDirectoryAsync(localImagesDir);
      const imageFolder = zip.folder('images');
      
      for (const fileName of files) {
        const filePath = `${localImagesDir}/${fileName}`;
        const base64Image = await FileSystem.readAsStringAsync(filePath, { encoding: 'base64' });
        imageFolder?.file(fileName, base64Image, { base64: true });
      }
    } catch (e) {
      console.log('本地图片目录读取失败或不存在，跳过图片备份');
    }

    // 生成 zip 文件 (ArrayBuffer 格式)
    const zipArrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    
    // 写入临时文件
    const fileName = useTimestamp ? this.generateBackupFileName() : 'sulv_backup.zip';
    const tempZipPath = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(tempZipPath, 
      arrayBufferToBase64(zipArrayBuffer), 
      { encoding: 'base64' }
    );

    // 上传到 WebDAV
    const remoteFilePath = `/${REMOTE_FOLDER_NAME}/${fileName}`;
    await this.client.putFileContents(remoteFilePath, zipArrayBuffer);
    
    // 清理临时文件
    await FileSystem.deleteAsync(tempZipPath, { idempotent: true });

    // 更新同步时间
    this.lastSyncTime = Date.now();
    
    return fileName;
  }

  // 获取远程备份列表
  async getBackupList(): Promise<BackupInfo[]> {
    if (!this.client) throw new Error('WebDAV 客户端未初始化');
    
    try {
      await this.ensureRemoteFolderExists();
      const contents = await this.client.getDirectoryContents(`/${REMOTE_FOLDER_NAME}`);
      
      return contents
        .filter((item: any) => item.type === 'file' && item.filename.endsWith('.zip'))
        .map((item: any) => ({
          fileName: item.basename,
          modifiedTime: new Date(item.lastModified).getTime(),
        }))
        .sort((a: BackupInfo, b: BackupInfo) => b.modifiedTime - a.modifiedTime);
    } catch (error) {
      console.error('获取备份列表失败:', error);
      return [];
    }
  }

  // 4. 从服务器下载并恢复数据
  async downloadBackup(
    localImagesDir: string, 
    remoteFileName?: string
  ): Promise<DownloadResult> {
    if (!this.client) {
      return { success: false, errorType: 'auth_failed' };
    }

    const fileName = remoteFileName || 'sulv_backup.zip';
    const remoteFilePath = `/${REMOTE_FOLDER_NAME}/${fileName}`;
    
    // 检查远程文件是否存在并获取内容
    let remoteData: ArrayBuffer;
    try {
      // React Native 中使用 fetch API 更可靠
      const fullUrl = `${this.remoteURL}${remoteFilePath}`;
      const authHeader = 'Basic ' + btoa(`${this.username}:${this.password}`);
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, errorType: 'file_not_found' };
        } else if (response.status === 401 || response.status === 403) {
          return { success: false, errorType: 'auth_failed' };
        } else {
          return { success: false, errorType: 'unknown' };
        }
      }
      
      remoteData = await response.arrayBuffer();
    } catch (error: any) {
      console.log('下载失败:', error);
      if (error.message?.includes('network') || error.message?.includes('Network')) {
        return { success: false, errorType: 'network_error' };
      }
      return { success: false, errorType: 'unknown' };
    }

    // 解压数据
    try {
      const zip = await JSZip.loadAsync(remoteData);

      // 解压 data.json - 返回数据而不是写入文件
      let dataJson: string = '';
      const dataFile = zip.file('data.json');
      if (dataFile) {
        dataJson = await dataFile.async('string');
      }

      // 解压图片到本地目录
      const imageFolder = zip.folder('images');
      if (imageFolder) {
        const dirInfo = await FileSystem.getInfoAsync(localImagesDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(localImagesDir, { intermediates: true });
        }
        
        const imageFiles = Object.keys(imageFolder.files);
        for (const filePath of imageFiles) {
          const file = imageFolder.files[filePath];
          if (!file.dir) {
            // 去除 images/ 前缀，只保留文件名
            const fileName = filePath.startsWith('images/') ? filePath.substring(7) : filePath;
            const base64Content = await file.async('base64');
            await FileSystem.writeAsStringAsync(`${localImagesDir}${fileName}`, base64Content, { encoding: 'base64' });
          }
        }
      }

      // 更新同步时间
      this.lastSyncTime = Date.now();
      
      return { success: true, dataJson };
    } catch (error: any) {
      console.log('解压失败:', error);
      return { success: false, errorType: 'unknown' };
    }
  }

  // 5. 自动同步 - 接收内存数据并上传
  async autoSyncWithData(dataJson: string, imageDir: string): Promise<string | null> {
    if (!this.client) {
      console.log('WebDAV 客户端未初始化，跳过自动同步');
      return null;
    }

    try {
      await this.ensureRemoteFolderExists();

      const zip = new JSZip();
      zip.file('data.json', dataJson);

      // 读取图片文件夹
      try {
        const files = await FileSystem.readDirectoryAsync(imageDir);
        const imageFolder = zip.folder('images');
        
        for (const fileName of files) {
          const filePath = `${imageDir}/${fileName}`;
          const base64Image = await FileSystem.readAsStringAsync(filePath, { encoding: 'base64' });
          imageFolder?.file(fileName, base64Image, { base64: true });
        }
      } catch (e) {
        console.log('图片目录读取失败或不存在，跳过图片备份');
      }

      // 生成 zip 文件 (ArrayBuffer 格式)
      const zipArrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
      const fileName = this.generateBackupFileName();
      const remoteFilePath = `/${REMOTE_FOLDER_NAME}/${fileName}`;
      
      // 上传到 WebDAV (ArrayBuffer 直接上传)
      await this.client.putFileContents(remoteFilePath, zipArrayBuffer);
      
      // 同时保存到本地缓存（用于本地恢复）
      const tempZipPath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(tempZipPath, 
        arrayBufferToBase64(zipArrayBuffer), 
        { encoding: 'base64' }
      );

      // 更新同步时间
      this.lastSyncTime = Date.now();
      
      console.log('自动同步成功:', fileName);
      return fileName;
    } catch (error) {
      console.error('自动同步失败:', error);
      return null;
    }
  }
}

export default new WebDavService();