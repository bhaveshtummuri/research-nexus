import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface BreadcrumbContextValue {
  entityLabel: string | undefined;
  setEntityLabel: (label: string | undefined) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [entityLabel, setEntityLabel] = useState<string | undefined>(undefined);
  const value = useMemo(() => ({ entityLabel, setEntityLabel }), [entityLabel]);

  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumbContext(): BreadcrumbContextValue {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error('Breadcrumb hooks must be used inside a BreadcrumbProvider.');
  }
  return context;
}

/**
 * Publishes the current entity's name to the breadcrumb trail.
 *
 * A detail route's last URL segment is an opaque id, which is meaningless in a
 * breadcrumb — only the page that fetched the entity knows its name. Rather
 * than have the shell reach into the query cache and guess at key shapes per
 * entity type, each detail page pushes its title up.
 *
 * The label is cleared on unmount so a stale name never survives into the next
 * route while that page's own data is still loading.
 */
export function useBreadcrumbLabel(label: string | undefined): void {
  const { setEntityLabel } = useBreadcrumbContext();

  useEffect(() => {
    setEntityLabel(label);
    return () => setEntityLabel(undefined);
  }, [label, setEntityLabel]);
}
