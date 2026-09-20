import React, { createContext, useContext, useMemo, useState } from 'react';
import { EMPTY_BETS_QUERY, type BetsQuery } from '../utils/betsQuery';

interface Ctx {
  query: BetsQuery;
  setQuery: (q: BetsQuery) => void;
}

const BetsQueryContext = createContext<Ctx>({ query: EMPTY_BETS_QUERY, setQuery: () => {} });

/**
 * The advanced bet filter, held ABOVE the stack navigator.
 *
 * The filter screen and the bet list are siblings in the stack, not parent and
 * child, so neither can hold this for the other. Passing it back through route
 * params would mean a non-serializable callback or a param the list has to
 * reach up through the drawer to read; a provider around the whole stack is
 * the one place both of them are inside.
 *
 * It deliberately does NOT go in `betsStore`: this is what the user is looking
 * at right now, not something to persist and restore next launch.
 */
export function BetsQueryProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState<BetsQuery>(EMPTY_BETS_QUERY);
  // Memoised: a fresh object here re-renders every consumer on every render of
  // the navigator, and the bet list is the expensive one.
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return <BetsQueryContext.Provider value={value}>{children}</BetsQueryContext.Provider>;
}

export function useBetsQuery(): Ctx {
  return useContext(BetsQueryContext);
}
