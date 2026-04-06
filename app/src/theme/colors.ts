/**
 * Placeholder color tokens — will be replaced by DESIGN.md in C.3.5.
 * Using Slate palette as a safe dark-mode starting point.
 */
export const colors = {
  // Backgrounds
  background: '#0F172A',
  surface: '#1E293B',
  surfaceLight: '#334155',

  // Text
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Accent
  accent: '#60A5FA',
  accentDark: '#1E40AF',

  // Semantic
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',

  // Alert level colors (matching device LED)
  alertNone: '#22C55E',    // green
  alertGentle: '#EAB308',   // yellow
  alertModerate: '#F97316', // orange
  alertUrgent: '#EF4444',   // red
  alertCritical: '#EF4444', // blinking red (animated in component)

  // Borders
  border: '#1E293B',
} as const;
