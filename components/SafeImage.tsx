import React, { useEffect, useState } from 'react';
import { Image, ImageProps, ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';

const placeholder = require('../assets/placeholder.png');

// Tự dùng ảnh placeholder khi sản phẩm THIẾU ảnh (uri rỗng) hoặc ảnh lỗi.
export function SafeImage({ source, style, resizeMode = 'cover' }: { source: ImageSourcePropType; style?: StyleProp<ViewStyle>; resizeMode?: ImageProps['resizeMode'] }) {
  const isUriSource = source && typeof source === 'object' && 'uri' in (source as any);
  const uri = isUriSource ? String((source as any).uri || '').trim() : 'static';
  const emptyUri = isUriSource && !uri;
  const [failed, setFailed] = useState(emptyUri);

  useEffect(() => { setFailed(emptyUri); }, [uri, emptyUri]);

  return (
    <Image
      source={failed || emptyUri ? placeholder : source}
      style={style as any}
      resizeMode={resizeMode}
      onError={() => setFailed(true)}
    />
  );
}
