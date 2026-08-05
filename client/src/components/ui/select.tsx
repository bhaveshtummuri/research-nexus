import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

/**
 * A native `<select>`.
 *
 * Filter controls are simple, single-choice, and benefit from the platform
 * picker on mobile - a custom listbox would add markup and keyboard handling
 * for no user-visible gain here.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-9 w-full appearance-none rounded-md border border-input bg-surface px-3 pr-8 text-sm shadow-subtle transition-colors',
        'bg-[length:16px] bg-[right_0.5rem_center] bg-no-repeat focus-visible:border-ring disabled:opacity-50',
        "bg-[url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='2' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
