import { LucideIcon, icons as LucideIcons } from 'lucide-react-native';
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';

const MAPPING = {
  home: 'Home',
  explore: 'Map',
  archive: 'Archive',
  settings: 'Settings',
  user: 'User',

  bird: 'Bird',
  feather: 'Feather',
  leaf: 'Leaf',
  tree: 'TreePine',
  globe: 'Globe',

  mic: 'Mic',
  waveform: 'Waveform',
  ear: 'Ear',
  music: 'Music',
  headphones: 'Headphones',

  camera: 'Camera',
  image: 'Image',
  gallery: 'ImagePlus',

  video: 'Video',
  film: 'Film',
  eye: 'Eye',
  brain: 'BrainCircuit',

  trash: 'Trash2',
  share: 'Share',
  upload: 'Upload',
  plus: 'PlusCircle',
  minus: 'MinusCircle',
  check: 'CheckCircle',
  x: 'XCircle',

  star: 'Star',
  sparkles: 'Sparkles',
  lightning: 'Zap',
  lightbulb: 'Lightbulb',
} as const;

export type IconSymbolName = keyof typeof MAPPING;

export function IconSymbol({
                             name,
                             size = 24,
                             color,
                             style,
                           }: {
  name: IconSymbolName;
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}) {
  const iconName = MAPPING[name];
  const LucideIconComponent = (LucideIcons as Record<string, LucideIcon>)[iconName] as LucideIcon;

  // Fallback in case the icon doesn't exist
  if (!LucideIconComponent) {
    console.warn(`Icon "${iconName}" not found in Lucide icons`);
    return null;
  }

  return <LucideIconComponent size={size} color={color} style={style} />;
}