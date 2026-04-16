export const lightTheme = {
  background: '#f9fafb',
  cardBg: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  primary: '#2563eb',
  primaryBg: '#eff6ff',
  primaryBorder: '#bfdbfe',
  disabled: '#d1d5db',
  dangerBg: '#fee2e2',
  dangerBorder: '#fca5a5',
  dangerText: '#ef4444',
  loader: '#2563eb',
  tabBg: '#e5e7eb',
};

export const darkTheme = {
  background: '#111827',     // Dark slate
  cardBg: '#1f2937',         // Slightly lighter slate for cards
  text: '#f9fafb',           // Off white
  textSecondary: '#9ca3af',  // Gray 400
  textMuted: '#6b7280',      // Gray 500
  border: '#374151',         // Gray 700
  primary: '#3b82f6',        // Slightly brighter blue for dark mode
  primaryBg: '#1e3a8a',      // Dark blue background for active elements
  primaryBorder: '#2563eb',  // Deep blue border
  disabled: '#4b5563',       // Gray 600
  dangerBg: '#7f1d1d',       // Deep red
  dangerBorder: '#991b1b',   // Slightly lighter red border
  dangerText: '#fca5a5',     // Light red text
  loader: '#60a5fa',         // Light blue loader
  tabBg: '#374151',          // Gray 700 for tabs
};

export type Theme = typeof lightTheme;
