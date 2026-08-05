import { AnimatePresence, motion } from 'framer-motion';
import { Command, Menu, Moon, Network, Search, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { RouteBoundary } from '@/components/common/route-boundary';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useTheme } from '@/hooks/use-theme';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

import { BreadcrumbProvider, useBreadcrumbContext } from './breadcrumb-context';
import { Breadcrumbs } from './breadcrumbs';
import { NAV_SECTIONS } from './sidebar-nav';
import { SearchDialog } from './search-dialog';
import { StatusMenu, UserMenu } from './status-menu';

/**
 * Application shell: fixed sidebar on desktop, slide-over on mobile, with the
 * routed page rendered into the main column.
 */
export function AppShell() {
  return (
    <BreadcrumbProvider>
      <AppShellLayout />
    </BreadcrumbProvider>
  );
}

function AppShellLayout() {
  const location = useLocation();
  const { entityLabel } = useBreadcrumbContext();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Navigating should always dismiss the mobile drawer.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Cmd/Ctrl+K opens search from anywhere, matching the convention users expect.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {isDesktop ? (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
          <SidebarContent />
        </aside>
      ) : (
        <AnimatePresence>
          {mobileNavOpen ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileNavOpen(false)}
                className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-surface lg:hidden"
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMobileNavOpen(false)}
                  className="absolute right-3 top-3"
                  aria-label="Close navigation"
                >
                  <X className="size-4" />
                </Button>
                <SidebarContent />
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </Button>

          <Breadcrumbs entityLabel={entityLabel} />

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className={cn(
              'group flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-muted-foreground transition-colors',
              // Grows to fill on small screens where the breadcrumb is hidden;
              // stays a fixed affordance on desktop so the trail keeps its room.
              'ml-auto w-full max-w-md md:w-64 lg:w-72',
              'hover:border-ring/50 hover:text-foreground',
            )}
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="truncate">Search the research graph…</span>
            <kbd className="ml-auto hidden items-center gap-0.5 rounded border border-border bg-surface-muted px-1.5 py-0.5 text-2xs sm:flex">
              <Command className="size-2.5" aria-hidden />K
            </kbd>
          </button>

          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <StatusMenu />
            <UserMenu />
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Inside the shell, so a crashing page keeps the sidebar and
                  header — the user can navigate out instead of reloading. */}
              <RouteBoundary>
                <Outlet />
              </RouteBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

function SidebarContent() {
  return (
    <>
      <div className="flex h-14 items-center gap-2.5 px-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-lg bg-primary/15 text-primary">
            <Network className="size-4" aria-hidden />
          </span>
          <span className="text-sm font-semibold tracking-tight">Research Nexus</span>
        </Link>
      </div>

      <Separator />

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            <p className="px-2 pb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.title}
            </p>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/12 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                <item.icon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-4">
        <p className="text-2xs leading-relaxed text-muted-foreground">
          Powered by <span className="font-medium text-foreground">CognoDB</span> over the Bolt
          protocol. Every view on this page is a graph traversal.
        </p>
      </div>
    </>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
