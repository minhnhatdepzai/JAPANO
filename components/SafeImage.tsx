import React, { useState } from 'react';
import { Image, ImageProps, ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';

const placeholder = require('../assets/placeholder.png');

export function SafeImage({ source, style, resizeMode = 'cover' }: { source: ImageSourcePropType; style?: StyleProp<ViewStyle>; resizeMode?: ImageProps['resizeMode'] }) {
  const [failed, setFailed] = useState(false);
  return <Image source={failed ? placeholder : source} style={style as any} resizeMode={resizeMode} onError={() => setFailed(true)} />;
}
