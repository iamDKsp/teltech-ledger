export const colors = {
  background: '#111113',
  foreground: '#fafafa',
  card: '#2b2b2e',
  cardBorder: '#313136',
  popover: '#1d1d20',
  input: '#232326',
  muted: '#36363c',
  mutedForeground: '#a1a1aa',
  primary: '#7C5AC2',
  primaryGlow: '#9B7AD8',
  success: '#27a06b',
  secondary: '#4080d6',
  destructive: '#d44040',
} as const;

export const priorityColors = {
  low: colors.muted,
  normal: colors.secondary,
  high: colors.primary,
  urgent: colors.destructive,
} as const;

export const statusColors = {
  active: colors.success,
  inactive: colors.mutedForeground,
  pending: colors.secondary,
  error: colors.destructive,
} as const;
