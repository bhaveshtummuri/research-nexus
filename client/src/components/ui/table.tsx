import type {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
  TableHTMLAttributes,
} from 'react';
import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

/**
 * Table primitives.
 *
 * Two things are handled here rather than left to each call site, because both
 * were being got wrong or skipped:
 *
 * - **Overflow.** A data table cannot reflow below ~600px, so it scrolls inside
 *   its own container. Without that the page itself scrolls sideways and the
 *   whole layout — sidebar included — drifts off screen on a phone.
 * - **Headers.** `<th>` carries `scope` by default. A screen reader announcing
 *   "row 14, 312" is useless; with scope it reads "Papers, 312".
 */

interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  /** Describes the table for screen readers. Rendered visually hidden. */
  caption?: string;
  /** Classes for the scroll container rather than the table itself. */
  containerClassName?: string;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className, caption, containerClassName, children, ...props }, ref) => (
    <div
      // tabIndex makes the scroll region reachable by keyboard: a scrollable box
      // that cannot be focused cannot be scrolled without a mouse.
      tabIndex={0}
      role="region"
      aria-label={caption}
      className={cn(
        'relative w-full overflow-x-auto rounded-lg border border-border',
        containerClassName,
      )}
    >
      <table ref={ref} className={cn('w-full caption-bottom text-left text-xs', className)} {...props}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  ),
);
Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn('border-b border-border bg-surface-muted/60', className)}
      {...props}
    />
  ),
);
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('divide-y divide-border', className)} {...props} />
  ),
);
TableBody.displayName = 'TableBody';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn('transition-colors hover:bg-accent/40 data-[state=selected]:bg-accent', className)}
      {...props}
    />
  ),
);
TableRow.displayName = 'TableRow';

interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Right-aligned with tabular figures, for numeric columns. */
  numeric?: boolean;
}

export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, numeric, scope = 'col', ...props }, ref) => (
    <th
      ref={ref}
      scope={scope}
      className={cn(
        'whitespace-nowrap px-4 py-2.5 font-medium text-muted-foreground',
        numeric && 'text-right',
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = 'TableHead';

interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, numeric, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        'px-4 py-2.5 align-middle',
        // Tabular figures keep digits in a column from jittering as values change.
        numeric && 'text-right tabular-nums',
        className,
      )}
      {...props}
    />
  ),
);
TableCell.displayName = 'TableCell';

/** Row header — the first cell of a row, naming what the row is about. */
export const TableRowHeader = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, scope = 'row', ...props }, ref) => (
    <th
      ref={ref}
      scope={scope}
      className={cn('px-4 py-2.5 text-left align-middle font-normal', className)}
      {...props}
    />
  ),
);
TableRowHeader.displayName = 'TableRowHeader';
