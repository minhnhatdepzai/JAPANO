import React from 'react';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { C, F } from '../theme/tokens';
import { JAPAN_SILHOUETTE_PATHS, JAPAN_SILHOUETTE_VIEWBOX } from '../lib/japanPaths';

type DirectPoint = { region: string; label: string; note?: string; cx: number; cy: number; placement: 'left' | 'right' | 'above' };
type CalloutPoint = { region: string; label: string; cx: number; cy: number; labelY: number };

// Toạ độ ước lượng bằng mắt trên chính hình dạng địa lý thật của Nhật Bản (từ
// file SVG nguồn), không phải trung tâm hành chính chính xác của từng vùng.
const DIRECT_POINTS: DirectPoint[] = [
  { region: 'Hokkaido', label: 'Hokkaido', note: 'đảo cực Bắc', cx: 731, cy: 183, placement: 'right' },
  { region: 'Tōhoku', label: 'Tōhoku', note: 'vùng Đông Bắc', cx: 664, cy: 427, placement: 'right' },
  { region: 'Kantō', label: 'Kantō', note: 'có Tokyo', cx: 621, cy: 591, placement: 'right' },
  { region: 'Chūbu', label: 'Chūbu', cx: 536, cy: 554, placement: 'above' },
];
// Kansai/Chūgoku/Shikoku/Kyūshū nằm rất sát nhau trên bản đồ thật nên nhãn
// được đưa ra vùng biển trống bên trái, nối về đúng điểm bằng đường dẫn mảnh.
const CALLOUT_POINTS: CalloutPoint[] = [
  { region: 'Kansai', label: 'Kansai · Kyoto, Osaka', cx: 457, cy: 658, labelY: 612 },
  { region: 'Chūgoku', label: 'Chūgoku', cx: 329, cy: 688, labelY: 662 },
  { region: 'Shikoku', label: 'Shikoku', cx: 329, cy: 743, labelY: 712 },
  { region: 'Kyūshū & Okinawa', label: 'Kyūshū', cx: 195, cy: 798, labelY: 800 },
];
const OKINAWA_DOT = { cx: 122, cy: 975, r: 18 };
const DOT_R = 25;
const GAP = 32;
const CALLOUT_X = 30;

function directLabelPos(p: DirectPoint) {
  switch (p.placement) {
    case 'right': return { x: p.cx + DOT_R + GAP, y: p.cy, anchor: 'start' as const };
    case 'left': return { x: p.cx - DOT_R - GAP, y: p.cy, anchor: 'end' as const };
    case 'above': return { x: p.cx, y: p.cy - DOT_R - GAP, anchor: 'middle' as const };
  }
}

export function JapanMap({ activeRegion, availableRegions, onSelect, height = 400 }: {
  activeRegion?: string;
  availableRegions: string[];
  onSelect: (region: string) => void;
  height?: number;
}) {
  const available = new Set(availableRegions);
  return (
    <Svg width="100%" height={height} viewBox={JAPAN_SILHOUETTE_VIEWBOX}>
      {JAPAN_SILHOUETTE_PATHS.map((d, i) => (
        <Path key={i} d={d} fill="#3E4A5C" stroke="#3E4A5C" strokeWidth={1} />
      ))}

      {CALLOUT_POINTS.map(p => {
        const enabled = available.has(p.region);
        const on = activeRegion === p.region;
        return (
          <Line key={`line-${p.region}`}
            x1={CALLOUT_X + 6} y1={p.labelY - 8} x2={p.cx} y2={p.cy}
            stroke={on ? C.shu : '#B9AE9E'} strokeWidth={on ? 2.5 : 1.5}
          />
        );
      })}

      <Circle
        cx={OKINAWA_DOT.cx} cy={OKINAWA_DOT.cy} r={OKINAWA_DOT.r}
        fill={activeRegion === 'Kyūshū & Okinawa' ? C.shu : available.has('Kyūshū & Okinawa') ? C.shuDeep : C.hair}
        stroke="#fff" strokeWidth={4}
        onPress={() => available.has('Kyūshū & Okinawa') && onSelect('Kyūshū & Okinawa')}
      />

      {DIRECT_POINTS.map(p => {
        const on = activeRegion === p.region;
        const enabled = available.has(p.region);
        const pos = directLabelPos(p);
        const fill = enabled ? '#241B14' : C.muted;
        return (
          <React.Fragment key={p.region}>
            <Circle
              cx={p.cx} cy={p.cy} r={on ? DOT_R + 4 : DOT_R}
              fill={on ? C.shu : enabled ? C.shuDeep : C.hair}
              stroke="#fff" strokeWidth={4}
              onPress={() => enabled && onSelect(p.region)}
            />
            {p.note ? (
              <>
                <SvgText x={pos.x} y={pos.y - 8} fontSize={34} fontWeight="700" fontFamily={F.bodyB} fill={fill} textAnchor={pos.anchor} onPress={() => enabled && onSelect(p.region)}>
                  {p.label}
                </SvgText>
                <SvgText x={pos.x} y={pos.y + 24} fontSize={26} fontFamily={F.body} fill="#5C5348" textAnchor={pos.anchor} onPress={() => enabled && onSelect(p.region)}>
                  {p.note}
                </SvgText>
              </>
            ) : (
              <SvgText x={pos.x} y={pos.y + 10} fontSize={34} fontWeight="700" fontFamily={F.bodyB} fill={fill} textAnchor={pos.anchor} onPress={() => enabled && onSelect(p.region)}>
                {p.label}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}

      {CALLOUT_POINTS.map(p => {
        const on = activeRegion === p.region;
        const enabled = available.has(p.region);
        return (
          <Circle
            key={p.region}
            cx={p.cx} cy={p.cy} r={on ? DOT_R + 4 : DOT_R}
            fill={on ? C.shu : enabled ? C.shuDeep : C.hair}
            stroke="#fff" strokeWidth={4}
            onPress={() => enabled && onSelect(p.region)}
          />
        );
      })}
      {CALLOUT_POINTS.map(p => {
        const enabled = available.has(p.region);
        return (
          <React.Fragment key={`label-${p.region}`}>
            <Circle cx={CALLOUT_X} cy={p.labelY - 12} r={5} fill={enabled ? C.shuDeep : C.hair} />
            <SvgText x={CALLOUT_X + 16} y={p.labelY - 4} fontSize={32} fontWeight="700" fontFamily={F.bodyB} fill={enabled ? '#241B14' : C.muted} textAnchor="start" onPress={() => enabled && onSelect(p.region)}>
              {p.label}
            </SvgText>
          </React.Fragment>
        );
      })}

      <SvgText x={OKINAWA_DOT.cx + OKINAWA_DOT.r + GAP} y={OKINAWA_DOT.cy + 10} fontSize={32} fontWeight="700" fontFamily={F.bodyB} fill={available.has('Kyūshū & Okinawa') ? '#241B14' : C.muted} textAnchor="start" onPress={() => available.has('Kyūshū & Okinawa') && onSelect('Kyūshū & Okinawa')}>
        Okinawa
      </SvgText>
    </Svg>
  );
}
