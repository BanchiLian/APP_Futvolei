import { IMAGE_UPLOAD } from '@futcheck/shared';

/**
 * Prepares a photo chosen on the phone before it is uploaded.
 *
 * Phone cameras produce 4–12 MB files, and on mobile data that is a slow upload
 * the user pays for. Drawing the image onto a canvas and re-encoding it sends a
 * fraction of the bytes — and, as a side effect, drops the EXIF block, so the
 * location never even leaves the device. The server strips it again anyway:
 * this is the courtesy, that is the guarantee.
 */

/** Longest side sent to the server, which reduces it further for storage. */
const MAX_SIDE = 1920;
const QUALITY = 0.85;

export class UnsupportedImageError extends Error {
  constructor() {
    super('Escolha uma imagem JPEG, PNG ou WebP.');
    this.name = 'UnsupportedImageError';
  }
}

export class ImageTooLargeError extends Error {
  constructor() {
    super('A imagem é grande demais. Escolha uma de até 8 MB.');
    this.name = 'ImageTooLargeError';
  }
}

function isAcceptedType(type: string): boolean {
  return (IMAGE_UPLOAD.acceptedMimeTypes as readonly string[]).includes(type);
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // `createImageBitmap` handles orientation and is far faster, but Safari only
  // grew the options we need recently, so a plain <img> is the fallback.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to the <img> path.
    }
  }

  const url = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new UnsupportedImageError());
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface PreparedImage {
  blob: Blob;
  /** Object URL for the preview. The caller revokes it when done. */
  previewUrl: string;
}

export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  if (file.type && !isAcceptedType(file.type)) throw new UnsupportedImageError();
  if (file.size > IMAGE_UPLOAD.maxBytes * 2) throw new ImageTooLargeError();

  const source = await loadBitmap(file);
  const width = 'width' in source ? source.width : 0;
  const height = 'height' in source ? source.height : 0;

  if (!width || !height) throw new UnsupportedImageError();

  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const context = canvas.getContext('2d');
  if (!context) throw new UnsupportedImageError();

  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ('close' in source) source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  );

  if (!blob) throw new UnsupportedImageError();
  if (blob.size > IMAGE_UPLOAD.maxBytes) throw new ImageTooLargeError();

  return { blob, previewUrl: URL.createObjectURL(blob) };
}
