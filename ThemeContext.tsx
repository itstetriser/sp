import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Theme, ThemeMode, getTheme } from './theme';

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [theme, setTheme] = useState<Theme>(getTheme('light'));

  useEffect(() => {
    // Load saved theme preference
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('themeMode');
        if (savedTheme === 'dark' || savedTheme === 'light') {
          setThemeMode(savedTheme);
          setTheme(getTheme(savedTheme));
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };

    loadTheme();
  }, []);

  const toggleTheme = () => {
    const newMode: ThemeMode = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newMode);
    setTheme(getTheme(newMode));
    
    // Save theme preference
    AsyncStorage.setItem('themeMode', newMode).catch(error => {
      console.error('Error saving theme:', error);
    });
  };

  const handleSetThemeMode = (mode: ThemeMode) => {
    setThemeMode(mode);
    setTheme(getTheme(mode));
    
    // Save theme preference
    AsyncStorage.setItem('themeMode', mode).catch(error => {
      console.error('Error saving theme:', error);
    });
  };

  const value: ThemeContextType = {
    theme,
    themeMode,
    toggleTheme,
    setThemeMode: handleSetThemeMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}; 