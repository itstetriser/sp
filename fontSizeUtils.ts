import { useFontSize } from './FontSizeContext';

export const createScaledStyle = (baseFontSize: number) => {
  return (fontSize: 'small' | 'medium' | 'large') => {
    const multiplier = getFontSizeMultiplier(fontSize);
    return Math.round(baseFontSize * multiplier);
  };
};

export const getFontSizeMultiplier = (fontSize: 'small' | 'medium' | 'large') => {
  switch (fontSize) {
    case 'small':
      return 0.85;
    case 'large':
      return 1.2;
    default:
      return 1.0;
  }
};

export const useScaledFontSize = (baseFontSize: number) => {
  const { fontSize } = useFontSize();
  const multiplier = getFontSizeMultiplier(fontSize);
  return Math.round(baseFontSize * multiplier);
}; 