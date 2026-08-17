import { createContext, useContext } from 'react';

/** Everything the Bets tab can be narrowed to when arriving from another screen. */
export interface BetsFilter {
  /** One calendar day, YYYY-MM-DD. */
  date?: string;
  tournament?: string;
  /** Team the bet backed — matched exactly the way the Insights tile counts. */
  team?: string;
  /** Exclusive lower bound on the day, so a tile's period carries into the list. */
  from?: string;
}

interface DrawerContextValue {
  openDrawer: () => void;
  /** Jump to the Bets tab, optionally narrowed to a day, tournament or team. */
  goToBets: (filter?: BetsFilter) => void;
}

export const DrawerContext = createContext<DrawerContextValue>({
  openDrawer: () => {},
  goToBets: () => {},
});
export const useDrawer = () => useContext(DrawerContext);
