/** Shared shape for every paginated list a service returns. */
export interface ListResult<T> {
  items: T[];
  total: number;
}
