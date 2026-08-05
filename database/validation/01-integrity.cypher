// ---------------------------------------------------------------------------
// Research Nexus - graph validation
//
// Reusable checks over a loaded graph. Every query follows one convention:
//
//     RETURN <check name>, <status>, <observed>, <expected>
//
// so the runner can print a pass/fail table without knowing what each check
// means. `status` is 'PASS' or 'FAIL'; a FAIL row carries enough context to act.
//
// Run with:  npm run db:validate
//
// These complement, not replace, the constraints. Constraints prevent
// duplicates at write time; these detect the failures a constraint cannot
// express - orphan nodes, missing relationships, broken invariants.
// ---------------------------------------------------------------------------

// === 1. NODE PRESENCE =======================================================
// Every label must exist and be populated. An empty label almost always means
// a seed step silently failed.

MATCH (n)
WITH head(labels(n)) AS label, count(n) AS observed
WITH collect({ label: label, observed: observed }) AS present
WITH present, [l IN ['Author','Paper','University','ResearchTopic','Keyword',
                     'Conference','Journal','Dataset','Project','FundingAgency']
               WHERE NOT l IN [p IN present | p.label]] AS missing
RETURN 'node-labels-present' AS check,
       CASE WHEN size(missing) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       present AS observed,
       missing AS missingLabels;

// === 2. RELATIONSHIP PRESENCE ==============================================

MATCH ()-[r]->()
WITH type(r) AS type, count(r) AS observed
WITH collect({ type: type, observed: observed }) AS present
WITH present, [t IN ['AUTHORED','CITES','AFFILIATED_WITH','HAS_TOPIC','HAS_KEYWORD',
                     'PUBLISHED_IN','PRESENTED_AT','USES_DATASET','FUNDS',
                     'COLLABORATED_WITH','RELATED_TO','INCLUDES','PARTNERS_WITH']
               WHERE NOT t IN [p IN present | p.type]] AS missing
RETURN 'relationship-types-present' AS check,
       CASE WHEN size(missing) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       present AS observed,
       missing AS missingTypes;

// === 3. ORPHAN NODES ========================================================
// A node with no relationships contributes nothing to any traversal. Keywords
// are exempt: an unused vocabulary term is legitimate.

MATCH (n)
WHERE NOT (n)--() AND NOT n:Keyword
WITH head(labels(n)) AS label, count(n) AS orphans, collect(n.id)[0..5] AS examples
RETURN 'orphan-nodes' AS check,
       CASE WHEN orphans = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       label, orphans, examples;

// === 4. REQUIRED RELATIONSHIPS =============================================
// Invariants the domain guarantees but no constraint can express.

// Every paper must have at least one author.
MATCH (p:Paper)
WHERE NOT (p)<-[:AUTHORED]-(:Author)
RETURN 'paper-has-author' AS check,
       CASE WHEN count(p) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(p) AS violations, collect(p.id)[0..5] AS examples;

// Every paper must be classified under at least one topic.
MATCH (p:Paper)
WHERE NOT (p)-[:HAS_TOPIC]->(:ResearchTopic)
RETURN 'paper-has-topic' AS check,
       CASE WHEN count(p) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(p) AS violations, collect(p.id)[0..5] AS examples;

// Every author must have a primary affiliation.
MATCH (a:Author)
WHERE NOT (a)-[:AFFILIATED_WITH { isPrimary: true }]->(:University)
RETURN 'author-has-primary-affiliation' AS check,
       CASE WHEN count(a) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(a) AS violations, collect(a.id)[0..5] AS examples;

// Every project must have at least one funder.
MATCH (p:Project)
WHERE NOT (p)<-[:FUNDS]-(:FundingAgency)
RETURN 'project-has-funder' AS check,
       CASE WHEN count(p) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(p) AS violations, collect(p.id)[0..5] AS examples;

// A topic with no papers is a vocabulary entry nothing was ever classified under.
MATCH (t:ResearchTopic)
WHERE NOT (t)<-[:HAS_TOPIC]-(:Paper)
RETURN 'topic-has-papers' AS check,
       CASE WHEN count(t) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(t) AS violations, collect(t.name)[0..5] AS examples;

// A university with no affiliated researchers contributes to no traversal.
MATCH (u:University)
WHERE NOT (u)<-[:AFFILIATED_WITH]-(:Author)
RETURN 'university-has-researchers' AS check,
       CASE WHEN count(u) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(u) AS violations, collect(u.name)[0..5] AS examples;

// Every paper needs a venue: a conference or a journal, never both.
MATCH (p:Paper)
OPTIONAL MATCH (p)-[:PRESENTED_AT]->(c:Conference)
OPTIONAL MATCH (p)-[:PUBLISHED_IN]->(j:Journal)
WITH p, count(c) AS conferences, count(j) AS journals
WHERE conferences + journals <> 1
RETURN 'paper-has-exactly-one-venue' AS check,
       CASE WHEN count(p) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(p) AS violations, collect(p.id)[0..5] AS examples;

// === 5. RELATIONSHIP DIRECTION AND ENDPOINTS ================================
// A relationship pointing at the wrong label is the most damaging modelling
// error, because queries silently return nothing rather than failing.

MATCH (a)-[:AUTHORED]->(b)
WHERE NOT a:Author OR NOT b:Paper
RETURN 'authored-endpoints' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(*) AS violations;

MATCH (a)-[:FUNDS]->(b)
WHERE NOT a:FundingAgency OR NOT b:Project
RETURN 'funds-endpoints' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(*) AS violations;

MATCH (a)-[:INCLUDES]->(b)
WHERE NOT a:Project OR NOT b:Paper
RETURN 'includes-endpoints' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(*) AS violations;

MATCH (a)-[:AFFILIATED_WITH]->(b)
WHERE NOT a:Author OR NOT b:University
RETURN 'affiliated-with-endpoints' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(*) AS violations;

// Any relationship touching a node without an id is a dangling reference.
MATCH (a)-[r]->(b)
WHERE a.id IS NULL OR b.id IS NULL
RETURN 'no-dangling-references' AS check,
       CASE WHEN count(r) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(r) AS violations;

// === 6. SELF-REFERENCES =====================================================
// A paper cannot cite itself; a researcher cannot collaborate with themselves.

MATCH (p:Paper)-[:CITES]->(p)
RETURN 'no-self-citation' AS check,
       CASE WHEN count(p) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(p) AS violations, collect(p.id)[0..5] AS examples;

MATCH (a:Author)-[:COLLABORATED_WITH]->(a)
RETURN 'no-self-collaboration' AS check,
       CASE WHEN count(a) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(a) AS violations, collect(a.id)[0..5] AS examples;

// === 7. DUPLICATE DETECTION ================================================
// Constraints prevent these at write time. Running the check anyway catches a
// graph loaded before the constraints were applied.

MATCH (a:Author)
WITH a.orcid AS orcid, count(a) AS occurrences, collect(a.id)[0..5] AS ids
WHERE occurrences > 1
RETURN 'duplicate-author-orcid' AS check, 'FAIL' AS status, orcid, occurrences, ids;

MATCH (p:Paper)
WITH p.doi AS doi, count(p) AS occurrences, collect(p.id)[0..5] AS ids
WHERE occurrences > 1
RETURN 'duplicate-paper-doi' AS check, 'FAIL' AS status, doi, occurrences, ids;

MATCH (k:Keyword)
WITH k.term AS term, count(k) AS occurrences, collect(k.id)[0..5] AS ids
WHERE occurrences > 1
RETURN 'duplicate-keyword-term' AS check, 'FAIL' AS status, term, occurrences, ids;

MATCH (t:ResearchTopic)
WITH t.name AS name, count(t) AS occurrences, collect(t.id)[0..5] AS ids
WHERE occurrences > 1
RETURN 'duplicate-topic-name' AS check, 'FAIL' AS status, name, occurrences, ids;

MATCH (u:University)
WITH u.name AS name, count(u) AS occurrences, collect(u.id)[0..5] AS ids
WHERE occurrences > 1
RETURN 'duplicate-university-name' AS check, 'FAIL' AS status, name, occurrences, ids;

MATCH (j:Journal)
WITH j.issn AS issn, count(j) AS occurrences, collect(j.id)[0..5] AS ids
WHERE occurrences > 1
RETURN 'duplicate-journal-issn' AS check, 'FAIL' AS status, issn, occurrences, ids;

// === 8. REQUIRED PROPERTIES ================================================
// Stands in for the existence constraints that are not portable.

MATCH (a:Author)
WHERE a.id IS NULL OR a.name IS NULL OR a.orcid IS NULL OR a.searchText IS NULL
RETURN 'author-required-properties' AS check,
       CASE WHEN count(a) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(a) AS violations, collect(a.id)[0..5] AS examples;

MATCH (p:Paper)
WHERE p.id IS NULL OR p.title IS NULL OR p.year IS NULL OR p.doi IS NULL
RETURN 'paper-required-properties' AS check,
       CASE WHEN count(p) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(p) AS violations, collect(p.id)[0..5] AS examples;

// === 9. TEMPORAL CONSISTENCY ===============================================
// Invariants that make the seeded graph believable and the trend queries valid.

// A paper cannot use a dataset released after it was written.
MATCH (p:Paper)-[:USES_DATASET]->(d:Dataset)
WHERE d.releaseYear > p.year
RETURN 'dataset-precedes-paper' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(*) AS violations;

// A project must end no earlier than it starts.
MATCH (p:Project)
WHERE p.endYear < p.startYear
RETURN 'project-year-order' AS check,
       CASE WHEN count(p) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(p) AS violations, collect(p.id)[0..5] AS examples;

// A paper may only cite strictly earlier work. This is what keeps CITES acyclic,
// and therefore what makes lineage traversal terminate.
MATCH (citing:Paper)-[:CITES]->(cited:Paper)
WHERE cited.year >= citing.year
RETURN 'citations-reference-earlier-papers' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(*) AS violations;

// === 10. DERIVED COUNTER ACCURACY ==========================================
// The two denormalisations in the model must agree with the edges they
// summarise. Drift here means the derivation pass did not run after a load.

MATCH (p:Paper)
OPTIONAL MATCH (p)<-[c:CITES]-(:Paper)
WITH p, count(c) AS actual
WHERE coalesce(p.citationCount, -1) <> actual
RETURN 'paper-citation-count-accurate' AS check,
       CASE WHEN count(p) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(p) AS drifted, collect(p.id)[0..5] AS examples;

MATCH (a:Author)
OPTIONAL MATCH (a)-[:AUTHORED]->(paper:Paper)
WITH a, count(paper) AS actual
WHERE coalesce(a.paperCount, -1) <> actual
RETURN 'author-paper-count-accurate' AS check,
       CASE WHEN count(a) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(a) AS drifted, collect(a.id)[0..5] AS examples;

// COLLABORATED_WITH must be derivable from AUTHORED: every co-authorship pair
// needs a corresponding edge.
MATCH (a:Author)-[:AUTHORED]->(:Paper)<-[:AUTHORED]-(b:Author)
WHERE a.id < b.id AND NOT (a)-[:COLLABORATED_WITH]-(b)
RETURN 'collaboration-edges-complete' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(*) AS missingEdges;

// === 11. UNDIRECTED EDGE CANONICALISATION ==================================
// COLLABORATED_WITH and PARTNERS_WITH are stored once, in canonical order.
// A reciprocal pair means the same fact is recorded twice and can disagree.

MATCH (a:Author)-[:COLLABORATED_WITH]->(b:Author)-[:COLLABORATED_WITH]->(a)
RETURN 'collaboration-stored-once' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(*) AS reciprocalPairs;

MATCH (a:University)-[:PARTNERS_WITH]->(b:University)-[:PARTNERS_WITH]->(a)
RETURN 'partnership-stored-once' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
       count(*) AS reciprocalPairs;
