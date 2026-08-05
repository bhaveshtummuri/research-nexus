import {
  Banknote,
  BookOpen,
  Building2,
  ChartNoAxesCombined,
  FileText,
  GitBranch,
  LayoutDashboard,
  Lightbulb,
  Network,
  Presentation,
  Quote,
  Route,
  Sparkles,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Marks the routes that showcase graph-native capability. */
  graphNative?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Navigation is split into "browse the catalogue" and "traverse the graph".
 * The second group is what a relational backend could not serve, so it is
 * grouped and labelled separately rather than mixed into the entity list.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', to: '/', icon: LayoutDashboard },
      { label: 'Analytics', to: '/analytics', icon: ChartNoAxesCombined },
    ],
  },
  {
    title: 'Explore',
    items: [
      { label: 'Authors', to: '/authors', icon: Users },
      { label: 'Papers', to: '/papers', icon: FileText },
      { label: 'Topics', to: '/topics', icon: Lightbulb },
      { label: 'Universities', to: '/universities', icon: Building2 },
      { label: 'Conferences', to: '/conferences', icon: Presentation },
      { label: 'Journals', to: '/journals', icon: BookOpen },
      { label: 'Funding', to: '/funding', icon: Banknote },
    ],
  },
  {
    title: 'Graph intelligence',
    items: [
      { label: 'Graph explorer', to: '/graph', icon: Network, graphNative: true },
      { label: 'Path finder', to: '/paths', icon: Route, graphNative: true },
      { label: 'Collaboration', to: '/collaboration', icon: GitBranch, graphNative: true },
      { label: 'Citations', to: '/citations', icon: Quote, graphNative: true },
      { label: 'Recommendations', to: '/recommendations', icon: Sparkles, graphNative: true },
    ],
  },
];
