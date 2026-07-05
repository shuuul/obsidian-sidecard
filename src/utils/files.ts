import { TFile } from 'obsidian';
import type { CardSourceType } from '../types';

const SUPPORTED_IMAGE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']);

export function getSourceType(file: TFile): CardSourceType {
  if (file.extension === 'md') return 'markdown';
  if (file.extension === 'pdf') return 'pdf';
  if (SUPPORTED_IMAGE_EXTENSIONS.has(file.extension.toLowerCase())) return 'image';
  return 'other';
}

export function isSupportedFile(file: TFile): boolean {
  const extension = file.extension.toLowerCase();
  return extension === 'md' || extension === 'pdf' || SUPPORTED_IMAGE_EXTENSIONS.has(extension);
}
