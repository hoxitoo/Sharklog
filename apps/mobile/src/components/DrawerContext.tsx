import { createContext, useContext } from 'react';

interface DrawerContextValue {
  openDrawer: () => void;
}

export const DrawerContext = createContext<DrawerContextValue>({ openDrawer: () => {} });
export const useDrawer = () => useContext(DrawerContext);
