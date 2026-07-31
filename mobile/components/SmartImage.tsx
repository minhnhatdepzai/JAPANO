import React from 'react';
import { Image as ExpoImage } from 'expo-image';
import { StyleProp, ImageStyle } from 'react-native';
import { C } from '../theme/tokens';

// Blurhash trung tính giúp khung ảnh luôn có nội dung trong lúc giải mã; cache
// memory-disk và transition ngắn tránh nhấp nháy khi cuộn danh sách.
const PLACEHOLDER = 'L6Pj0^~q00_3?bM{RjRj00IU%MRj';

export function SmartImage({
  source,
  style,
  contentFit = 'cover',
  recyclingKey,
}: {
  source: any;
  style?: StyleProp<ImageStyle> | any;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  recyclingKey?: string;
}) {
  return (
    <ExpoImage
      source={source}
      style={[{ backgroundColor: C.washi2 }, style]}
      contentFit={contentFit}
      placeholder={PLACEHOLDER}
      placeholderContentFit={contentFit}
      cachePolicy="memory-disk"
      transition={140}
      recyclingKey={recyclingKey}
    />
  );
}
