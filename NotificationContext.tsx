// NotificationContext.tsx
import React, { createContext, useState, useContext, ReactNode } from 'react';

interface NotificationContextType {
  hasNewWords: boolean;
  setHasNewWords: (value: boolean) => void;
}

// Create the context with a default value
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Create a provider component
export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [hasNewWords, setHasNewWords] = useState(false);

  return (
    <NotificationContext.Provider value={{ hasNewWords, setHasNewWords }}>
      {children}
    </NotificationContext.Provider>
  );
};

// Create a custom hook to use the context easily
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
