import sharp, { type Sharp } from 'sharp';

import { ERROR_CODES } from '@futcheck/shared';

import { badRequest } from './errors.js';

/**
 * Turns an uploaded file into an image we are willing to store.
 *
 * Three things happen here, and each one is a security control:
 *
 * 1. **The file is decoded, not trusted.** The client's content-type is a claim;
 *    what matters is whether sharp can decode it. A file named `photo.jpg` that
 *    is really a script never gets past this.
 * 2. **Everything is re-encoded to WebP**, which drops all metadata — including
 *    the EXIF GPS tags a phone camera writes. Sharing a photo from the court
 *    must not publish the coordinates of where it was taken.
 * 3. **Decoding is bounded.** `limitInputPixels` stops a decompression bomb: a
 *    small file that expands into gigabytes of pixels and takes the server down.
 */

/** 80 megapixels: far beyond any phone camera, far below a bomb. */
const MAX_INPUT_PIXELS = 80_000_000;

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
}

export interface ProcessOptions {
  /** Longest side of the result, in pixels. */
  maxSize: number;
  quality?: number;
}

function decode(input: Buffer): Sharp {
  // `rotate()` applies the EXIF orientation flag before the rest of the metadata
  // is discarded, or portrait photos would come out sideways.
  return sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' }).rotate();
}

/**
 * Runs a pipeline and reports anything it refuses as a bad upload.
 *
 * Every failure in here means "this file is not a usable image" — which is the
 * user's problem to fix, not a server fault. Without this the raw decoder error
 * escaped as a 500, telling the user the app was broken when their file was.
 */
async function render(pipeline: Sharp): Promise<ProcessedImage> {
  try {
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw badRequest(ERROR_CODES.UNSUPPORTED_FILE_TYPE);
  }
}

export function processImage(input: Buffer, options: ProcessOptions): Promise<ProcessedImage> {
  return render(
    decode(input)
      .resize({
        width: options.maxSize,
        height: options.maxSize,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: options.quality ?? 82 }),
  );
}

/** A square crop, for avatars and thumbnails. */
export function processSquareImage(input: Buffer, size: number): Promise<ProcessedImage> {
  return render(
    decode(input)
      // `attention` crops towards the busiest area, which on a photo of people is
      // usually the people.
      .resize({ width: size, height: size, fit: 'cover', position: 'attention' })
      .webp({ quality: 80 }),
  );
}
