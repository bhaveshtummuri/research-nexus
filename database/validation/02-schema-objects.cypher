// ---------------------------------------------------------------------------
// Research Nexus - constraint and index verification
//
// Confirms the schema objects from `database/schema/` actually exist on the
// running instance. A missing index does not break correctness, but it turns an
// index seek into a label scan - so this is the check that catches a schema
// step that was skipped in a deployment.
//
// `SHOW CONSTRAINTS` / `SHOW INDEXES` are Neo4j-compatible administrative
// commands. The runner tolerates their absence on engines that do not implement
// them, so this file is advisory rather than required.
// ---------------------------------------------------------------------------

// All constraints currently defined.
SHOW CONSTRAINTS
YIELD name, type, entityType, labelsOrTypes, properties
RETURN name, type, entityType, labelsOrTypes, properties
ORDER BY name;

// All indexes, with their population state. An index stuck below 100% is still
// building and will not yet be used by the planner.
SHOW INDEXES
YIELD name, type, entityType, labelsOrTypes, properties, state, populationPercent
RETURN name, type, entityType, labelsOrTypes, properties, state, populationPercent
ORDER BY name;

// Indexes that are not yet online.
SHOW INDEXES
YIELD name, state
WHERE state <> 'ONLINE'
RETURN 'indexes-online' AS check, 'FAIL' AS status, name, state;
