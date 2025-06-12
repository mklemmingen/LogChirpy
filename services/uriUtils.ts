/**
 * URI Utilities for LogChirpy
 * 
 * Handles proper conversion between file system paths and URIs for React Native Image components.
 * Ensures cross-platform compatibility and proper URI formatting.
 */

import * as FileSystem from 'expo-file-system';

/**
 * Converts a file system path to a proper URI for React Native Image component
 * @param filePath - The file system path (e.g., "/data/user/0/app/files/photo.jpg")
 * @returns Properly formatted URI (e.g., "file:///data/user/0/app/files/photo.jpg")
 */
export function filePathToUri(filePath: string): string {
  if (!filePath) {
    return '';
  }

  // If it's already a proper URI (starts with file://, http://, https://, etc.)
  if (filePath.includes('://')) {
    return filePath;
  }

  // Ensure the path starts with a forward slash
  const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
  
  // Add the file protocol
  return `file://${normalizedPath}`;
}

/**
 * Converts a URI back to a file system path
 * @param uri - The URI (e.g., "file:///data/user/0/app/files/photo.jpg")
 * @returns File system path (e.g., "/data/user/0/app/files/photo.jpg")
 */
export function uriToFilePath(uri: string): string {
  if (!uri) {
    return '';
  }

  // If it's already a file path (no protocol)
  if (!uri.includes('://')) {
    return uri;
  }

  // Remove file protocol if present
  if (uri.startsWith('file://')) {
    return uri.replace('file://', '');
  }

  // Return as-is for other protocols (http, https, etc.)
  return uri;
}

/**
 * Validates if a URI/path points to an existing file
 * @param uriOrPath - URI or file path to validate
 * @returns Promise that resolves to true if file exists, false otherwise
 */
export async function validateImageUri(uriOrPath: string): Promise<boolean> {
  if (!uriOrPath) {
    return false;
  }

  try {
    // Convert to file path for FileSystem operations
    const filePath = uriToFilePath(uriOrPath);
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    return fileInfo.exists;
  } catch (error) {
    console.warn('URI validation failed:', error);
    return false;
  }
}

/**
 * Generates a proper URI for saving images in the gallery directory
 * @param filename - The filename for the image
 * @returns Properly formatted URI for the gallery directory
 */
export function generateGalleryImageUri(filename: string): string {
  const galleryDir = `${FileSystem.documentDirectory}gallery/`;
  const filePath = `${galleryDir}${filename}`;
  return filePathToUri(filePath);
}

/**
 * Generates a proper URI for saving images in the document directory
 * @param filename - The filename for the image
 * @returns Properly formatted URI for the document directory
 */
export function generateDocumentImageUri(filename: string): string {
  const filePath = `${FileSystem.documentDirectory}${filename}`;
  return filePathToUri(filePath);
}

/**
 * Ensures gallery directory exists and returns its path
 * @returns Promise that resolves to the gallery directory path
 */
export async function ensureGalleryDirectory(): Promise<string> {
  const galleryDir = `${FileSystem.documentDirectory}gallery/`;
  
  try {
    const dirInfo = await FileSystem.getInfoAsync(galleryDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(galleryDir, { intermediates: true });
      console.log('Created gallery directory:', galleryDir);
    }
  } catch (error) {
    console.error('Failed to create gallery directory:', error);
    throw error;
  }
  
  return galleryDir;
}

/**
 * Safely copies a file and returns the proper URI
 * @param sourceUri - Source file URI
 * @param destinationPath - Destination file path
 * @returns Promise that resolves to the properly formatted destination URI
 */
export async function copyFileWithProperUri(
  sourceUri: string, 
  destinationPath: string
): Promise<string> {
  try {
    // Ensure the source is a proper file path for FileSystem operations
    const sourcePath = uriToFilePath(sourceUri);
    
    await FileSystem.copyAsync({
      from: sourcePath,
      to: destinationPath
    });
    
    // Return proper URI for the destination
    return filePathToUri(destinationPath);
  } catch (error) {
    console.error('File copy failed:', error);
    throw error;
  }
}

/**
 * Gets a list of image URIs from a directory
 * @param directoryPath - Path to the directory
 * @param fileExtensions - Array of file extensions to include (default: ['.jpg', '.jpeg', '.png'])
 * @returns Promise that resolves to array of properly formatted URIs
 */
export async function getImageUrisFromDirectory(
  directoryPath: string,
  fileExtensions: string[] = ['.jpg', '.jpeg', '.png']
): Promise<string[]> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(directoryPath);
    if (!dirInfo.exists) {
      return [];
    }

    const files = await FileSystem.readDirectoryAsync(directoryPath);
    const imageFiles = files.filter(filename => 
      fileExtensions.some(ext => filename.toLowerCase().endsWith(ext.toLowerCase()))
    );

    return imageFiles.map(filename => {
      const filePath = `${directoryPath}${filename}`;
      return filePathToUri(filePath);
    });
  } catch (error) {
    console.error('Failed to read directory images:', error);
    return [];
  }
}