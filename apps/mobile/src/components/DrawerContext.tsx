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
  /** Calendar year, for drill-downs that are scoped to one year. */
  year?: number;
  /** Bets that carry no tournament — the counterpart to `tournament`. */
  noTournament?: boolean;
  /**
   * Exactly these bets — a run of wins, the biggest loss: what a tapped
   * Analytics tile is made of. `labelKey` is the tile's own title (a
   * translation key), shown over the list so it says what it is.
   */
  selection?: { ids: string[]; labelKey: string };
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
