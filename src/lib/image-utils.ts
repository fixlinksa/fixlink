/**
 * Smart image compression utility for FixLink.
 * Progressively compresses images to reach a target file size while maintaining quality.
 */
export const smartCompressImage = async (
  file: File, 
  maxWidth: number = 1600, 
  targetSizeKB: number = 800
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Progressive Compression Logic
        let quality = 0.9;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Approx size calculation from base64 (33% overhead)
        let sizeInBytes = (dataUrl.length * 3) / 4;
        let sizeInKB = sizeInBytes / 1024;

        // Iteratively reduce quality if needed to reach target size
        while (sizeInKB > targetSizeKB && quality > 0.3) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          sizeInBytes = (dataUrl.length * 3) / 4;
          sizeInKB = sizeInBytes / 1024;
        }

        console.log(`[SmartCompress] Original: ${file.size / 1024}KB, Optimized: ${sizeInKB}KB, Quality: ${quality}`);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};
