import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Get the cache directory for input-mcp based on the OS
 * - macOS: ~/Library/Caches/input-mcp
 * - Linux: ~/.cache/input-mcp
 * - Windows: %LOCALAPPDATA%/input-mcp/Cache
 */
export function getCacheDir(): string {
  const platform = process.platform;
  const homeDir = os.homedir();

  switch (platform) {
    case 'darwin': // macOS
      return path.join(homeDir, 'Library', 'Caches', 'input-mcp');
    case 'win32': // Windows
      return path.join(process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local'), 'input-mcp', 'Cache');
    default: // Linux and others
      return path.join(process.env.XDG_CACHE_HOME || path.join(homeDir, '.cache'), 'input-mcp');
  }
}

/**
 * Ensure the cache directory exists
 */
export async function ensureCacheDir(): Promise<string> {
  const cacheDir = getCacheDir();
  const imagesDir = path.join(cacheDir, 'images');

  await fs.mkdir(imagesDir, { recursive: true });

  return imagesDir;
}

/**
 * Generate a unique filename with timestamp
 */
export function generateImageFilename(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -1);
  const random = Math.random().toString(36).substring(2, 8);
  return `img_${timestamp}_${random}.png`;
}

/**
 * Save base64 image data to PNG file
 */
export async function saveImageToCache(dataUrl: string): Promise<string> {
  // Ensure cache directory exists
  const imagesDir = await ensureCacheDir();

  // Extract base64 data from data URL
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // Generate unique filename
  const filename = generateImageFilename();
  const filepath = path.join(imagesDir, filename);

  // Write file
  await fs.writeFile(filepath, buffer);

  //console.error(`Image saved to cache: ${filepath}`);
  return filepath;
}

/**
 * Get the path to a cached image
 */
export function getCachedImagePath(filename: string): string {
  return path.join(getCacheDir(), 'images', filename);
}

/**
 * List all cached images
 */
export async function listCachedImages(): Promise<string[]> {
  const imagesDir = path.join(getCacheDir(), 'images');

  try {
    const files = await fs.readdir(imagesDir);
    return files.filter(f => f.endsWith('.png'));
  } catch (error) {
    // Directory doesn't exist yet
    return [];
  }
}

/**
 * Clean old cache files (older than specified days)
 */
export async function cleanOldCache(daysToKeep: number = 7): Promise<number> {
  const imagesDir = path.join(getCacheDir(), 'images');
  const now = Date.now();
  const maxAge = daysToKeep * 24 * 60 * 60 * 1000; // Convert days to milliseconds
  let deletedCount = 0;

  try {
    const files = await fs.readdir(imagesDir);

    for (const file of files) {
      const filepath = path.join(imagesDir, file);
      const stats = await fs.stat(filepath);

      if (now - stats.mtimeMs > maxAge) {
        await fs.unlink(filepath);
        deletedCount++;
      }
    }
  } catch (error) {
    // Directory doesn't exist or other error
    console.error('Error cleaning cache:', error);
  }

  return deletedCount;
}