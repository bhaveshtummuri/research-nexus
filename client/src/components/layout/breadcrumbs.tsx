import { ChevronRight } from 'lucide-react';
import { Fragment, useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { NAV_SECTIONS } from './sidebar-nav';

/** Path segments that name a section rather than an entity. */
const SEGMENT_LABELS: Record<string, string> = {
  authors: 'Researchers',
  papers: 'Publications',
  topics: 'Research topics',
  universities: 'Institutions',
  conferences: 'Conferences',
  journals: 'Journals',
  funding: 'Funding',
  graph: 'Graph explorer',
  paths: 'Path finder',
  collaboration: 'Collaboration',
  citations: 'Citations',
  recommendations: 'Recommendations',
  analytics: 'Analytics',
};

export interface Crumb {
  label: string;
  to?: string;
}

/**
 * Derives the trail from the URL.
 *
 * The last segment of a detail route is an opaque id (`author-0042`), which
 * would be meaningless in a breadcrumb. The page that knows the entity's name
 * supplies it through `entityLabel`; until it loads, the crumb reads "Loading…"
 * rather than flashing a raw id.
 */
export function useBreadcrumbs(entityLabel?: string): Crumb[] {
  const { pathname } = useLocation();
  const params = useParams();

  return useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return [];

    const idValues = new Set(Object.values(params).filter(Boolean));
    const crumbs: Crumb[] = [{ label: 'Home', to: '/' }];

    segments.forEach((segment, index) => {
      const to = `/${segments.slice(0, index + 1).join('/')}`;
      const isLast = index === segments.length - 1;
      const isEntityId = idValues.has(segment);

      const label = isEntityId
        ? (entityLabel ?? 'Loading…')
        : (SEGMENT_LABELS[segment] ?? toTitleCase(segment));

      // The final crumb is the current page, so it is not a link.
      crumbs.push(isLast ? { label } : { label, to });
    });

    return crumbs;
  }, [pathname, params, entityLabel]);
}

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' ');
}

/** Resolves the icon registered for a top-level route, if the nav declares one. */
function useSectionIcon(pathname: string) {
  return useMemo(() => {
    const root = `/${pathname.split('/').filter(Boolean)[0] ?? ''}`;
    for (const section of NAV_SECTIONS) {
      const match = section.items.find((item) => item.to === root);
      if (match) return match.icon;
    }
    return null;
  }, [pathname]);
}

/**
 * The trail.
 *
 * `entityLabel` is normally supplied by the current detail page through
 * `useBreadcrumbLabel`; the prop exists so the component can be rendered and
 * tested without the surrounding provider.
 */
export function Breadcrumbs({ entityLabel }: { entityLabel?: string }) {
  const { pathname } = useLocation();
  const crumbs = useBreadcrumbs(entityLabel);
  const Icon = useSectionIcon(pathname);

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center md:flex">
      <ol className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
        {Icon ? <Icon className="mr-1 size-3.5 shrink-0" aria-hidden /> : null}
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 ? (
                <ChevronRight className="size-3 shrink-0 opacity-50" aria-hidden />
              ) : null}
              <li className="min-w-0">
                {crumb.to && !isLast ? (
                  <Link
                    to={crumb.to}
                    className="truncate transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className="block max-w-[16rem] truncate font-medium text-foreground"
                    aria-current="page"
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
