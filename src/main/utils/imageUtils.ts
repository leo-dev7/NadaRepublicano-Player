import { nativeImage, NativeImage } from 'electron'

/**
 * Inverts an image vertically (flips scanlines top-to-bottom).
 * DirectShow video frame capture in MPC-HC / MPC-BE outputs bottom-up DIBs,
 * which causes /snapshot.jpg to be vertically inverted.
 * This function restores the natural right-side-up orientation.
 */
export function flipImageVertically(image: NativeImage): NativeImage {
  const size = image.getSize()
  if (size.width <= 0 || size.height <= 0) return image

  const bitmap = image.toBitmap()
  const width = size.width
  const height = size.height
  const rowBytes = width * 4

  // Guard against unexpected buffer sizes
  if (bitmap.length < rowBytes * height) {
    return image
  }

  const flippedBuffer = Buffer.allocUnsafe(bitmap.length)

  for (let y = 0; y < height; y++) {
    const srcOffset = y * rowBytes
    const destOffset = (height - 1 - y) * rowBytes
    bitmap.copy(flippedBuffer, destOffset, srcOffset, srcOffset + rowBytes)
  }

  return nativeImage.createFromBitmap(flippedBuffer, { width, height })
}

/**
 * Decodes a raw image buffer (e.g. from MPC's /snapshot.jpg),
 * inverts it vertically so it is right-side up, and returns both
 * the corrected NativeImage (ready for clipboard) and a JPEG Buffer (ready for saving to disk).
 */
export function processMpcSnapshot(rawBuffer: Buffer): {
  image: NativeImage
  jpegBuffer: Buffer
} {
  const original = nativeImage.createFromBuffer(rawBuffer)
  if (original.isEmpty()) {
    throw new Error('Imagem vazia ou corrompida retornada pelo player.')
  }

  const image = flipImageVertically(original)
  const jpegBuffer = image.toJPEG(92)

  return {
    image,
    jpegBuffer
  }
}

