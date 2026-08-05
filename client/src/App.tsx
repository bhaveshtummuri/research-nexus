import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';

import { DetailSkeleton, GraphSkeleton, ListPageSkeleton } from '@/components/common/loading';
import { AppShell } from '@/components/layout/app-shell';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/hooks/use-theme';
import { queryClient } from '@/lib/query-client';
import { DashboardPage } from '@/pages/dashboard';

/**
 * Routing.
 *
 * The dashboard is imported eagerly because it is the entry point; every other
 * page is split out, so the heavy dependencies (charts, the force simulation)
 * only reach the browser when a route that needs them is visited.
 */
const AnalyticsPage = lazy(() => import('@/pages/analytics').then((m) => ({ default: m.AnalyticsPage })));
const AuthorsPage = lazy(() => import('@/pages/authors').then((m) => ({ default: m.AuthorsPage })));
const AuthorDetailPage = lazy(() =>
  import('@/pages/author-detail').then((m) => ({ default: m.AuthorDetailPage })),
);
const PapersPage = lazy(() => import('@/pages/papers').then((m) => ({ default: m.PapersPage })));
const PaperDetailPage = lazy(() =>
  import('@/pages/paper-detail').then((m) => ({ default: m.PaperDetailPage })),
);
const TopicsPage = lazy(() => import('@/pages/topics').then((m) => ({ default: m.TopicsPage })));
const TopicDetailPage = lazy(() =>
  import('@/pages/topic-detail').then((m) => ({ default: m.TopicDetailPage })),
);
const UniversitiesPage = lazy(() =>
  import('@/pages/universities').then((m) => ({ default: m.UniversitiesPage })),
);
const UniversityDetailPage = lazy(() =>
  import('@/pages/university-detail').then((m) => ({ default: m.UniversityDetailPage })),
);
const ConferencesPage = lazy(() =>
  import('@/pages/venues').then((m) => ({ default: m.ConferencesPage })),
);
const JournalsPage = lazy(() => import('@/pages/venues').then((m) => ({ default: m.JournalsPage })));
const ConferenceDetailPage = lazy(() =>
  import('@/pages/venue-detail').then((m) => ({ default: m.ConferenceDetailPage })),
);
const JournalDetailPage = lazy(() =>
  import('@/pages/venue-detail').then((m) => ({ default: m.JournalDetailPage })),
);
const FundingPage = lazy(() => import('@/pages/funding').then((m) => ({ default: m.FundingPage })));
const FundingAgencyDetailPage = lazy(() =>
  import('@/pages/funding-detail').then((m) => ({ default: m.FundingAgencyDetailPage })),
);
const GraphExplorerPage = lazy(() =>
  import('@/pages/graph-explorer').then((m) => ({ default: m.GraphExplorerPage })),
);
const PathFinderPage = lazy(() =>
  import('@/pages/path-finder').then((m) => ({ default: m.PathFinderPage })),
);
const CollaborationPage = lazy(() =>
  import('@/pages/collaboration').then((m) => ({ default: m.CollaborationPage })),
);
const CitationsPage = lazy(() =>
  import('@/pages/citations').then((m) => ({ default: m.CitationsPage })),
);
const RecommendationsPage = lazy(() =>
  import('@/pages/recommendations').then((m) => ({ default: m.RecommendationsPage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/not-found').then((m) => ({ default: m.NotFoundPage })),
);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/*
          `reducedMotion="user"` makes every framer-motion animation in the tree
          honour the OS setting. The CSS media query in globals.css cannot reach
          these — framer animates via JS, outside the cascade — so without this
          the sidebar and page transitions kept moving for users who asked them
          not to.
        */}
        <MotionConfig reducedMotion="user">
          <TooltipProvider delayDuration={200}>
            <BrowserRouter>
              <Routes>
                <Route element={<AppShell />}>
                  <Route
                    path="/"
                    element={
                      <Suspense fallback={<DetailSkeleton />}>
                        <DashboardPage />
                      </Suspense>
                    }
                  />
                  <Route path="/analytics" element={withSuspense(<AnalyticsPage />)} />

                  <Route path="/authors" element={withSuspense(<AuthorsPage />, 'list')} />
                  <Route path="/authors/:id" element={withSuspense(<AuthorDetailPage />)} />

                  <Route path="/papers" element={withSuspense(<PapersPage />, 'list')} />
                  <Route path="/papers/:id" element={withSuspense(<PaperDetailPage />)} />

                  <Route path="/topics" element={withSuspense(<TopicsPage />, 'list')} />
                  <Route path="/topics/:id" element={withSuspense(<TopicDetailPage />)} />

                  <Route path="/universities" element={withSuspense(<UniversitiesPage />, 'list')} />
                  <Route path="/universities/:id" element={withSuspense(<UniversityDetailPage />)} />

                  <Route path="/conferences" element={withSuspense(<ConferencesPage />, 'list')} />
                  <Route path="/conferences/:id" element={withSuspense(<ConferenceDetailPage />)} />

                  <Route path="/journals" element={withSuspense(<JournalsPage />, 'list')} />
                  <Route path="/journals/:id" element={withSuspense(<JournalDetailPage />)} />

                  <Route path="/funding" element={withSuspense(<FundingPage />, 'list')} />
                  <Route path="/funding/:id" element={withSuspense(<FundingAgencyDetailPage />)} />

                  <Route path="/graph" element={withSuspense(<GraphExplorerPage />, 'graph')} />
                  <Route path="/paths" element={withSuspense(<PathFinderPage />)} />
                  <Route path="/collaboration" element={withSuspense(<CollaborationPage />)} />
                  <Route path="/citations" element={withSuspense(<CitationsPage />)} />
                  <Route path="/recommendations" element={withSuspense(<RecommendationsPage />)} />

                  <Route path="*" element={withSuspense(<NotFoundPage />)} />
                </Route>
              </Routes>
            </BrowserRouter>

            <Toaster
              position="bottom-right"
              // Screen readers get the toast text without the visual styling
              // fighting them; sonner handles the live region itself.
              toastOptions={{
                classNames: {
                  toast:
                    'bg-[hsl(var(--surface-raised))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] shadow-overlay',
                  description: 'text-[hsl(var(--muted-foreground))]',
                  actionButton: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]',
                  error: 'border-[hsl(var(--destructive)/0.4)]',
                  success: 'border-[hsl(var(--success)/0.4)]',
                  warning: 'border-[hsl(var(--warning)/0.4)]',
                },
              }}
            />
          </TooltipProvider>
        </MotionConfig>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * The fallback is chosen per route shape.
 *
 * A detail skeleton standing in for a list page is worse than no skeleton: the
 * placeholder settles into a layout that never arrives, so the page visibly
 * rearranges itself at the exact moment the user starts reading it.
 */
function withSuspense(element: ReactNode, shape: 'detail' | 'list' | 'graph' = 'detail') {
  const fallback =
    shape === 'list' ? <ListPageSkeleton /> : shape === 'graph' ? <GraphSkeleton /> : <DetailSkeleton />;

  return <Suspense fallback={fallback}>{element}</Suspense>;
}
