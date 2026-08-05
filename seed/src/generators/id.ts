/** Zero-padded, stable identifiers keep ids sortable and readable in the UI. */
export function id(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(4, '0')}`;
}
