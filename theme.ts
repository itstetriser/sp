export interface Theme {
  // Background colors
  backgroundColor: string;
  surfaceColor: string;
  cardColor: string;
  
  // Text colors
  primaryText: string;
  secondaryText: string;
  accentText: string;
  
  // Primary colors
  primary: string;
  primaryLight: string;
  primaryDark: string;
  
  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Border colors
  borderColor: string;
  dividerColor: string;
  
  // Overlay colors
  overlayColor: string;
  
  // Specific component colors
  tabBarBackground: string;
  tabBarActive: string;
  tabBarInactive: string;
  
  // Medal colors
  bronze: string;
  silver: string;
  gold: string;
  orange: string;
  gray: string;
  
  // Soft colors
  softBronze: string;
  softSilver: string;
  softGold: string;
  softOrange: string;
  softGray: string;
  softBlue: string;
}

export const lightTheme: Theme = {
  // Background colors
  backgroundColor: '#ffffff',
  surfaceColor: '#f8f9fa',
  cardColor: '#ffffff',
  
  // Text colors
  primaryText: '#333333',
  secondaryText: '#666666',
  accentText: '#1976D2',
  
  // Primary colors
  primary: '#1976D2',
  primaryLight: '#e3f2fd',
  primaryDark: '#0d47a1',
  
  // Status colors
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  info: '#2196f3',
  
  // Border colors
  borderColor: '#e0e0e0',
  dividerColor: '#f0f0f0',
  
  // Overlay colors
  overlayColor: 'rgba(0,0,0,0.3)',
  
  // Tab bar colors
  tabBarBackground: '#ffffff',
  tabBarActive: '#1976D2',
  tabBarInactive: '#999999',
  
  // Medal colors
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  orange: '#ff9800',
  gray: '#eee',
  
  // Soft colors
  softBronze: '#e6b17a',
  softSilver: '#d4d4d4',
  softGold: '#f4e4a6',
  softOrange: '#ffb366',
  softGray: '#f5f5f5',
  softBlue: '#e3f2fd',
};

export const darkTheme: Theme = {
  // Background colors
  backgroundColor: '#121212',
  surfaceColor: '#1e1e1e',
  cardColor: '#2d2d2d',
  
  // Text colors
  primaryText: '#ffffff',
  secondaryText: '#b0b0b0',
  accentText: '#64b5f6',
  
  // Primary colors
  primary: '#64b5f6',
  primaryLight: '#1e3a5f',
  primaryDark: '#42a5f5',
  
  // Status colors
  success: '#66bb6a',
  warning: '#ffb74d',
  error: '#ef5350',
  info: '#42a5f5',
  
  // Border colors
  borderColor: '#404040',
  dividerColor: '#2d2d2d',
  
  // Overlay colors
  overlayColor: 'rgba(0,0,0,0.7)',
  
  // Tab bar colors
  tabBarBackground: '#1e1e1e',
  tabBarActive: '#64b5f6',
  tabBarInactive: '#666666',
  
  // Medal colors
  bronze: '#8b4513',
  silver: '#a0a0a0',
  gold: '#daa520',
  orange: '#ff8c00',
  gray: '#404040',
  
  // Soft colors
  softBronze: '#4a2c0a',
  softSilver: '#2a2a2a',
  softGold: '#3d2c0a',
  softOrange: '#4a2c0a',
  softGray: '#2d2d2d',
  softBlue: '#1e3a5f',
};

export type ThemeMode = 'light' | 'dark';

export const getTheme = (mode: ThemeMode): Theme => {
  return mode === 'dark' ? darkTheme : lightTheme;
}; 