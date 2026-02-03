'use client';

import { useState, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';

interface UseImageUploadReturn {
  file: File | null;
  previewUrl: string | null;
  uploading: boolean;
  uploadedPath: string | null;
  uploadedUrl: string | null;
  error: string | null;
  selectFile: (file: File) => void;
  uploadFile: () => Promise<{ path: string; url: string } | null>;
  clearFile: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function useImageUpload(): UseImageUploadReturn {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectFile = useCallback((selectedFile: File) => {
    setError(null);
    setUploadedPath(null);
    setUploadedUrl(null);

    // バリデーション
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setError('JPEG、PNG、WebP形式の画像のみアップロードできます');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('ファイルサイズは10MB以下にしてください');
      return;
    }

    setFile(selectedFile);

    // プレビュー用URLを生成
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
  }, []);

  const uploadFile = useCallback(async () => {
    if (!file || !user) {
      setError('ファイルまたはユーザー情報がありません');
      return null;
    }

    setUploading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const extension = file.name.split('.').pop() || 'jpg';
      const path = `users/${user.uid}/originals/${timestamp}.${extension}`;
      const storageRef = ref(storage, path);

      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      setUploadedPath(path);
      setUploadedUrl(url);

      return { path, url };
    } catch (err) {
      console.error('Upload error:', err);
      setError('画像のアップロードに失敗しました');
      return null;
    } finally {
      setUploading(false);
    }
  }, [file, user]);

  const clearFile = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
    setUploadedPath(null);
    setUploadedUrl(null);
    setError(null);
  }, [previewUrl]);

  return {
    file,
    previewUrl,
    uploading,
    uploadedPath,
    uploadedUrl,
    error,
    selectFile,
    uploadFile,
    clearFile,
  };
}
