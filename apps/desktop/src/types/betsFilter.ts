/** Everything the Bets page can be narrowed to when arriving from another page. */
export interface BetsFilter {
  tournament?: string;
  /** Team the bet backed — matched exactly the way the Insights tile counts. */
  team?: string;
  /** Exclusive lower bound on the day, so a tile's period carries into the list. */
  from?: string;
  /** Calendar year, for drill-downs that are scoped to one year. */
  year?: number;
  /** Bets that carry no tournament — the counterpart to `tournament`. */
  noTournament?: boolean;
}
