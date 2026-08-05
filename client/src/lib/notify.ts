import { toast } from 'sonner';

/**
 * The application's notification vocabulary.
 *
 * Everything goes through here rather than calling `toast` directly, for three
 * reasons:
 *
 * - **One meaning per level.** Success confirms something finished, info reports
 *   a fact the user did not ask about, warning flags a degraded result they can
 *   still use, error means the action did not happen. Call sites picking freely
 *   is how a product ends up with red toasts for non-failures.
 * - **Durations follow severity.** An error stays long enough to read twice; a
 *   success is gone before it becomes clutter.
 * - **Dedup ids.** A failing query retried three times must not stack three
 *   identical toasts.
 *
 * Toasts are for transitions — something *happened*. A persistent condition
 * belongs in an `ErrorState` panel where it stays visible.
 */

interface NotifyOptions {
  description?: string;
  /** Collapses repeats of the same condition into one toast. */
  id?: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

const DURATION = {
  success: 3_000,
  info: 4_000,
  warning: 6_000,
  /** Long enough to read the description and reach for the action. */
  error: 8_000,
} as const;

function options(level: keyof typeof DURATION, opts: NotifyOptions = {}) {
  return {
    duration: opts.duration ?? DURATION[level],
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.id ? { id: opts.id } : {}),
    ...(opts.action ? { action: { label: opts.action.label, onClick: opts.action.onClick } } : {}),
  };
}

export const notify = {
  success: (message: string, opts?: NotifyOptions) =>
    toast.success(message, options('success', opts)),

  error: (message: string, opts?: NotifyOptions) => toast.error(message, options('error', opts)),

  warning: (message: string, opts?: NotifyOptions) =>
    toast.warning(message, options('warning', opts)),

  info: (message: string, opts?: NotifyOptions) => toast.info(message, options('info', opts)),

  /**
   * Ties a toast to a promise, so a slow action reports its own outcome.
   *
   * Only worth using where the action is slow enough to need acknowledging and
   * can genuinely fail — an export, a refetch. Wrapping something instant just
   * makes the loading state flash.
   */
  promise: <T>(
    promise: Promise<T>,
    messages: { loading: string; success: string | ((value: T) => string); error: string },
  ) => toast.promise(promise, messages),

  dismiss: (id?: string) => toast.dismiss(id),
} as const;
