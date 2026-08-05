/**
 * A Cypher statement that the query runner is willing to execute.
 *
 * The brand is what enforces the project's hard rule: no query text may ever be
 * built by concatenation. Because `runRead`/`runWrite` accept only
 * `CypherStatement`, a plain `string` - and therefore anything assembled from
 * user input - is rejected by the compiler.
 */
export type CypherStatement = string & { readonly __cypher: unique symbol };

/**
 * Tagged template for declaring Cypher.
 *
 * Interpolation is refused at runtime as well as by the type system, so the
 * only way to vary a query is through driver parameters (`$name`), which the
 * database plans and caches safely.
 *
 * ```ts
 * const FIND_AUTHOR = cypher`MATCH (a:Author {id: $id}) RETURN a`;
 * ```
 */
export function cypher(strings: TemplateStringsArray, ...values: unknown[]): CypherStatement {
  if (values.length > 0) {
    throw new Error(
      'Cypher templates must not interpolate values. Pass them as query parameters instead.',
    );
  }
  const [statement] = strings.raw;
  return (statement ?? '').trim() as CypherStatement;
}
