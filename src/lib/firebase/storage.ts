import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import app from './client';

const storage = getStorage(app);

/**
 * Compresses an image file on the client using HTML Canvas.
 * Caps maximum dimension to 1600px and exports JPEG with 0.85 quality.
 */
export async function compressImage(file: File, maxDimension = 1600, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas context not available'));
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas compression failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads an event poster image to Firebase Storage and returns the public download URL.
 * Falls back to high-quality compressed Base64 data URL if Firebase Storage bucket is offline/unconfigured.
 */
export async function uploadEventPoster(
  file: File,
  eventId: string = 'temp_poster',
  onProgress?: (percent: number) => void
): Promise<string> {
  // 1. Client-side compression
  const compressedBlob = await compressImage(file);

  // 2. Try Firebase Storage upload
  try {
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName || bucketName.includes('placeholder')) {
      throw new Error('Firebase Storage bucket not configured in environment.');
    }

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `event-posters/${eventId}/${Date.now()}_${cleanFileName}`;
    const storageRef = ref(storage, storagePath);

    const uploadTask = uploadBytesResumable(storageRef, compressedBlob, {
      contentType: 'image/jpeg',
      customMetadata: { eventId, originalName: file.name },
    });

    return await new Promise<string>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(Math.round(progress));
        },
        (error) => {
          console.warn('Firebase Storage upload failed, falling back to base64:', error);
          reject(error);
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        }
      );
    });
  } catch {
    // 3. Fallback: Convert compressed blob to Base64 Data URL so upload never blocks the user
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(compressedBlob);
    });
  }
}
