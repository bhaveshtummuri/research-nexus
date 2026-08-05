import { cn, LABEL_STYLES } from '@/lib/utils';
import type { NodeLabel } from '@/types/api';

/** Colour-coded label chip, using the same palette as the graph canvas. */
export function EntityBadge({
  label,
  className,
  showDot = true,
}: {
  label: NodeLabel;
  className?: string;
  showDot?: boolean;
}) {
  const style = LABEL_STYLES[label];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium',
        style.badge,
        className,
      )}
    >
      {showDot ? <span className={cn('size-1.5 rounded-full', style.dot)} aria-hidden /> : null}
      {style.name}
    </span>
  );
}
