export type CropArea = {
  width: number;
  height: number;
  x: number;
  y: number;
};

export type ImageCropResult = {
  imageUrl: string;
  imageFile?: File;
};

export const getCroppedImg = async (imageSrc: string, cropArea: CropArea): Promise<ImageCropResult | null> => {
  const canvas = document.createElement('canvas');
  const img = new Image();

  const imageBlobPromise = new Promise<Blob | null>((resolve) => {
    img.onload = () => {
      const scaleX = img.width / img.naturalWidth;
      const scaleY = img.height / img.naturalHeight;
      canvas.width = cropArea.width;
      canvas.height = cropArea.height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // Draw the cropped image
        ctx.drawImage(
          img,
          cropArea.x * scaleX,
          cropArea.y * scaleY,
          cropArea.width * scaleX,
          cropArea.height * scaleY,
          0,
          0,
          cropArea.width,
          cropArea.height
        );
      }

      canvas.toBlob((blob: Blob | null) => {
        if (!blob) {
          console.error('Canvas is empty');
          return resolve(null);
        }
        resolve(blob);
      }, 'image/jpeg');
    };
    img.onerror = () => {
      console.error('Failed to load image');
      resolve(null);
    };
    img.src = imageSrc;
  });

  const imageBlob = await imageBlobPromise;
  if (!imageBlob) {
    return null;
  }

  const processedImageUrl = URL.createObjectURL(imageBlob);
  const processedImageFile = new File([imageBlob], 'croppedImage', {
    type: imageBlob.type, // MIME type 'image/jpeg' ??
    lastModified: Date.now(),
  });

  return { imageUrl: processedImageUrl, imageFile: processedImageFile };
};

export const blobToBase64 = (blob: Blob): Promise<string | undefined> => {
  return new Promise((resolve, _) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    } catch {
      resolve(undefined);
    }
  });
};
