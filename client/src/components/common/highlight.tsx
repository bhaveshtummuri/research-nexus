import { Fragment, useMemo } from 'react';

import { cn } from '@/lib/utils';

/**
 * Marks the part of a string that matched the query.
 *
 * Highlighting is what turns a result list into an explanation: seeing *why* a
 * row matched is the difference between trusting the ranking and re-reading
 * every entry. Rendered as `<mark>` so assistive tech announces the emphasis
 * rather than relying on colour alone.
 */
export function Highlight({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}) {
  const segments = useMemo(() => splitOnMatches(text, query), [text, query]);

  return (
    <>
      {segments.map((segment, index) =>
        segment.matched ? (
          <mark
            key={index}
            className={cn('rounded-[2px] bg-primary/25 px-0.5 text-inherit', className)}
          >
            {segment.value}
          </mark>
        ) : (
          <Fragment key={index}>{segment.value}</Fragment>
        ),
      )}
    </>
  );
}

interface Segment {
  value: string;
  matched: boolean;
}

/**
 * Splits `text` on every occurrence of `query`, case-insensitively.
 *
 * Terms are matched individually so a two-word query highlights both words even
 * when the result orders them differently — the server's search does not require
 * an exact phrase, so the highlight must not either.
 *
 * Exported for testing.
 */
export function splitOnMatches(text: string, query: string): Segment[] {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);

  if (terms.length === 0) return [{ value: text, matched: false }];

  const haystack = text.toLowerCase();
  // A boolean per character, so overlapping terms merge into one run rather than
  // producing nested or duplicated marks.
  const hits = new Array<boolean>(text.length).fill(false);

  for (const term of terms) {
    let from = 0;
    for (;;) {
      const index = haystack.indexOf(term, from);
      if (index === -1) break;
      for (let offset = index; offset < index + term.length; offset += 1) hits[offset] = true;
      from = index + term.length;
    }
  }

  const segments: Segment[] = [];
  let start = 0;

  for (let index = 1; index <= text.length; index += 1) {
    if (index === text.length || hits[index] !== hits[start]) {
      segments.push({ value: text.slice(start, index), matched: hits[start] === true });
      start = index;
    }
  }

  return segments.length > 0 ? segments : [{ value: text, matched: false }];
}
