import { useState, useCallback, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { saveImage, deleteImages, getImageUri } from '../utils/imageStorage';

const MAX_IMAGES = 9;

interface UseImageManagerOptions {
  diaryId: string;
  initialImages: string[];
  onImagesChange: (images: string[]) => void;
  showAlert: (title: string, message?: string, actions?: any[]) => void;
}

export function useImageManager({ diaryId, initialImages, onImagesChange, showAlert }: UseImageManagerOptions) {
  const [images, setImages] = useState<string[]>(initialImages);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteImages, setPendingDeleteImages] = useState<string[]>([]);
  const imagesRef = useRef(images);
  imagesRef.current = images;

  const updateImages = useCallback((newImages: string[]) => {
    setImages(newImages);
    onImagesChange(newImages);
  }, [onImagesChange]);

  const pickFromLibrary = useCallback(async () => {
    const currentImages = imagesRef.current;
    if (currentImages.length >= MAX_IMAGES) {
      showAlert('提示', `最多只能添加 ${MAX_IMAGES} 张图片`);
      return null;
    }

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showAlert('权限提示', '需要访问相册权限才能添加图片');
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - currentImages.length,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        setIsSaving(true);
        const latestImages = imagesRef.current;
        const newImages: string[] = [];
        for (let i = 0; i < result.assets.length; i++) {
          const fileName = await saveImage(result.assets[i].uri, diaryId, latestImages.length + i);
          if (fileName) newImages.push(fileName);
        }
        if (newImages.length > 0) {
          const updatedImages = [...imagesRef.current, ...newImages].slice(0, MAX_IMAGES);
          updateImages(updatedImages);
          setIsSaving(false);
          return updatedImages;
        }
        setIsSaving(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showAlert('错误', '选择图片时出错');
      setIsSaving(false);
    }
    return null;
  }, [diaryId, showAlert, updateImages]);

  const takePhoto = useCallback(async () => {
    const currentImages = imagesRef.current;
    if (currentImages.length >= MAX_IMAGES) {
      showAlert('提示', `最多只能添加 ${MAX_IMAGES} 张图片`);
      return null;
    }

    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        showAlert('权限提示', '需要相机权限才能拍照');
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsSaving(true);
        const fileName = await saveImage(result.assets[0].uri, diaryId, imagesRef.current.length);
        if (fileName) {
          const updatedImages = [...imagesRef.current, fileName].slice(0, MAX_IMAGES);
          updateImages(updatedImages);
          setIsSaving(false);
          return updatedImages;
        }
        setIsSaving(false);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      showAlert('错误', '拍照时出错');
      setIsSaving(false);
    }
    return null;
  }, [diaryId, showAlert, updateImages]);

  const removeImage = useCallback((index: number) => {
    showAlert('删除图片', '确定要删除这张图片吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          const currentImages = imagesRef.current;
          const fileName = currentImages[index];
          if (fileName && !fileName.startsWith('data:')) {
            setPendingDeleteImages((prev) => (prev.includes(fileName) ? prev : [...prev, fileName]));
          }
          const updatedImages = currentImages.filter((_, i) => i !== index);
          updateImages(updatedImages);
        },
      },
    ]);
  }, [showAlert, updateImages]);

  const reorderImages = useCallback((newOrder: string[]) => {
    updateImages(newOrder);
  }, [updateImages]);

  const setImagesDirectly = useCallback((newImages: string[]) => {
    setImages(newImages);
  }, []);

  const flushPendingDeletes = useCallback(async () => {
    if (pendingDeleteImages.length > 0) {
      await deleteImages(pendingDeleteImages);
      setPendingDeleteImages([]);
    }
  }, [pendingDeleteImages]);

  return {
    images,
    isSaving,
    pendingDeleteImages,
    pickFromLibrary,
    takePhoto,
    removeImage,
    reorderImages,
    setImagesDirectly,
    flushPendingDeletes,
    MAX_IMAGES,
  };
}
