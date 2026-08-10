import { createContext, useContext } from 'react';

interface DrawerContextValue {
  openDrawer: () => void;
  /** Jump to the Bets tab, optionally filtered to one day (YYYY-MM-DD). */
  goToBets: (date?: string) => void;
}

export const DrawerContext = createContext<DrawerContextValue>({
  openDrawer: () => {},
  goToBets: () => {},
});
export const useDrawer = () => useContext(DrawerContext);
