import sharp, { type Exif } from 'sharp';
import { describe, expect, it } from 'vitest';

import { processImage, processSquareImage } from './images.js';

/** A JPEG carrying EXIF, including the GPS tags a phone camera writes. */
async function photoWithLocation(width = 1200, height = 800): Promise<Buffer> {
  return (
    sharp({
      create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } },
    })
      // sharp's Exif type does not declare the GPS block, but it writes it — and
      // GPS is exactly what this test exists to prove gets stripped.
      .withExif({
        IFD0: { Make: 'FutCheck Phone', Model: 'Test' },
        GPS: { GPSLatitudeRef: 'S', GPSLongitudeRef: 'W' },
      } as Exif)
      .jpeg()
      .toBuffer()
  );
}

describe('processImage', () => {
  it('strips the location a camera wrote into the photo', async () => {
    const original = await sharp(await photoWithLocation()).metadata();
    expect(original.exif).toBeDefined();

    const processed = await processImage(await photoWithLocation(), { maxSize: 1440 });
    const metadata = await sharp(processed.data).metadata();

    // The whole point: a photo shared from the court must not publish where it
    // was taken.
    expect(metadata.exif).toBeUndefined();
  });

  it('re-encodes everything to webp, whatever came in', async () => {
    const png = await sharp({
      create: { width: 300, height: 200, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer();

    const processed = await processImage(png, { maxSize: 1440 });
    expect((await sharp(processed.data).metadata()).format).toBe('webp');
  });

  it('shrinks a large photo to the longest side and keeps its proportions', async () => {
    const processed = await processImage(await photoWithLocation(4000, 3000), { maxSize: 1440 });

    expect(processed.width).toBe(1440);
    expect(processed.height).toBe(1080);
  });

  it('never enlarges a small photo', async () => {
    const small = await sharp({
      create: { width: 320, height: 240, channels: 3, background: '#000000' },
    })
      .jpeg()
      .toBuffer();

    const processed = await processImage(small, { maxSize: 1440 });

    expect(processed.width).toBe(320);
    expect(processed.height).toBe(240);
  });

  it('reports the dimensions of what it actually produced', async () => {
    const processed = await processImage(await photoWithLocation(800, 600), { maxSize: 1440 });
    const metadata = await sharp(processed.data).metadata();

    expect([processed.width, processed.height]).toEqual([metadata.width, metadata.height]);
  });

  it('refuses a file that is not an image, whatever it claims to be', async () => {
    const notAnImage = Buffer.from('<?php system($_GET["c"]); ?>', 'utf8');

    await expect(processImage(notAnImage, { maxSize: 1440 })).rejects.toMatchObject({
      code: 'UNSUPPORTED_FILE_TYPE',
    });
  });

  it('refuses a truncated image instead of storing half of one', async () => {
    const truncated = (await photoWithLocation()).subarray(0, 120);

    await expect(processImage(truncated, { maxSize: 1440 })).rejects.toBeDefined();
  });
});

describe('processSquareImage', () => {
  it('always produces a square of the requested size', async () => {
    const processed = await processSquareImage(await photoWithLocation(1200, 400), 128);

    expect(processed.width).toBe(128);
    expect(processed.height).toBe(128);
  });

  it('strips metadata too', async () => {
    const processed = await processSquareImage(await photoWithLocation(), 512);
    expect((await sharp(processed.data).metadata()).exif).toBeUndefined();
  });
});
