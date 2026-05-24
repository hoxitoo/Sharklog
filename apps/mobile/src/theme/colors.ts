export const colors = {
  bg: '#0A0A0A',
  bgCard: '#141414',
  bgElevated: '#1E1E1E',
  border: '#2A2A2A',

  accent: '#00D4AA',      // shark teal — primary CTA
  accentDim: '#00D4AA22',
  gold: '#F5C842',        // pro badge
  red: '#FF4757',
  green: '#2ED573',
  yellow: '#FFA502',

  textPrimary: '#FFFFFF',
  textSecondary: '#8A8A8A',
  textMuted: '#4A4A4A',

  won: '#2ED573',
  lost: '#FF4757',
  pending: '#FFA502',
  refund: '#8A8A8A',
} as const;

export type Colors = typeof colors;
