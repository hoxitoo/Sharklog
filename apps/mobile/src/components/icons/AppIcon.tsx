import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';
import { GLYPHS, GLYPH_BOX, type GlyphName, type Paint, type Shape } from './glyphs';
import { colors } from '../../theme/colors';

/*
 * The author's own icon set — menu, sports, esports disciplines — from the SVG
 * kit in docs/design/icons. Every shape names the role of its colour: the
 * silhouette (`body`) takes the text colour of where it sits, the brand detail
 * (`accent`) the theme's accent — `purpleText`: violet on dark and light, lime
 * on olive, gold on navy — and the heart its own raspberry. One set of shapes,
 * four palettes.
 *
 * Colours are read at render, never stored: `colors` is live and a theme switch
 * remounts the tree.
 */
export function AppIcon({ name, size, color, accent, support, style }: {
  name: GlyphName;
  size: number;
  /** The silhouette. Defaults to the secondary text colour. */
  color?: string;
  /** The brand detail. Defaults to the theme accent. */
  accent?: string;
  /** The heart. Defaults to raspberry. */
  support?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const paints: Record<Exclude<Paint, 'none'>, string> = {
    body: color ?? colors.textSecondary,
    accent: accent ?? colors.purpleText,
    support: support ?? colors.raspberry,
  };
  const ink = (p: Paint | undefined) => (p && p !== 'none' ? paints[p] : 'none');
  const shapes: readonly Shape[] = GLYPHS[name];
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GLYPH_BOX} ${GLYPH_BOX}`} style={style}>
      {shapes.map((s, i) => {
        const common = {
          fill: ink(s.fill),
          ...(s.stroke ? { stroke: ink(s.stroke), strokeWidth: s.strokeWidth ?? 1 } : {}),
          ...(s.round ? { strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const } : {}),
          ...(s.evenOdd ? { fillRule: 'evenodd' as const } : {}),
        };
        if (s.kind === 'circle') return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} />;
        if (s.kind === 'ellipse') return <Ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common} />;
        return <Path key={i} d={s.d ?? ''} {...common} />;
      })}
    </Svg>
  );
}

export { sportGlyph, disciplineGlyph } from './glyphNames';
