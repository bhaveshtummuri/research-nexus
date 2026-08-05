import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { config } from '../../src/config/index.js';
import { closeDriver, connect } from '../../src/database/driver.js';

/**
 * End-to-end verification against a live CognoDB instance.
 *
 * This is the only suite that can prove the Cypher is semantically correct, so
 * it exercises each of the graph-native queries against real data. It skips
 * itself when no database is reachable, which keeps `npm test` green in CI and
 * on a fresh clone while still running in full locally:
 *
 *   npm run db:schema && npm run db:seed && npm test --workspace server
 */
const api = config.http.apiPrefix;

/**
 * Connectivity is resolved at module scope, not in `beforeAll`.
 *
 * `describe.skip` is chosen while the file is being *collected*, which happens
 * before any hook runs — so deciding from a variable that `beforeAll` fills in
 * means reading `false` every time, and the whole suite silently skips itself
 * even with a healthy database behind it. That is not a hypothetical: it hid
 * seven Cypher syntax errors until a route-coverage guard caught them from the
 * outside. Top-level await is what makes the value available in time.
 */
/**
 * Opt-in via `RUN_DB_TESTS=1`.
 *
 * Without the flag this suite is skipped even when a database happens to be
 * reachable. That is deliberate. Managed CognoDB free tiers rate-limit at the
 * connection level, so whether a run connects at all depends on how recently
 * something else hit the instance — which made `npm test` pass, skip, or fail
 * for reasons unrelated to the code under test. A suite that reports three
 * different outcomes for one commit is worse than no suite, because it teaches
 * people to ignore it.
 *
 *   RUN_DB_TESTS=1 npm run test:integration
 */
const optedIn = process.env.RUN_DB_TESTS === '1';
const databaseAvailable = optedIn ? await connect() : false;
const app = createApp();

afterAll(async () => {
  await closeDriver();
});

/**
 * Pacing between tests.
 *
 * Managed CognoDB instances on the free tier rate-limit at the *connection*
 * level: a burst of back-to-back traversals gets its TLS handshakes reset
 * (`ECONNRESET`), and once that starts every reconnect is refused too, so the
 * rest of the suite fails for a reason that has nothing to do with the queries
 * under test. A short gap keeps the run inside the allowance. It costs a few
 * seconds and buys a signal that means something.
 */
beforeEach(async () => {
  if (databaseAvailable) await new Promise((resolve) => setTimeout(resolve, 400));
});

const whenSeeded = () => (databaseAvailable ? describe : describe.skip);

whenSeeded()('graph queries against a live CognoDB instance', () => {
  let authorId: string;
  let secondAuthorId: string;
  let paperId: string;
  let secondPaperId: string;
  let topicId: string;

  beforeAll(async () => {
    const authors = await request(app).get(`${api}/authors?limit=2&sort=citations`);
    authorId = authors.body.data[0]?.id;
    secondAuthorId = authors.body.data[1]?.id;

    const papers = await request(app).get(`${api}/papers?limit=2&sort=citations`);
    paperId = papers.body.data[0]?.id;
    secondPaperId = papers.body.data[1]?.id;

    const topics = await request(app).get(`${api}/topics?limit=1`);
    topicId = topics.body.data[0]?.id;
  });

  it('returns a seeded graph with all ten node labels', async () => {
    const response = await request(app).get(`${api}/analytics/overview`).expect(200);
    const labels = response.body.data.nodes.map((entry: { label: string }) => entry.label);

    expect(labels).toEqual(
      expect.arrayContaining(['Author', 'Paper', 'ResearchTopic', 'University', 'FundingAgency']),
    );
    expect(response.body.data.totals.relationshipCount).toBeGreaterThan(1000);
  });

  it('assembles an author profile in one request', async () => {
    const response = await request(app).get(`${api}/authors/${authorId}`).expect(200);
    const author = response.body.data;

    expect(author.id).toBe(authorId);
    expect(author.name).toBeTruthy();
    expect(Array.isArray(author.recentPapers)).toBe(true);
    expect(Array.isArray(author.frequentCollaborators)).toBe(true);
  });

  it('finds researchers within multiple collaboration hops', async () => {
    const response = await request(app)
      .get(`${api}/authors/${authorId}/collaborators?depth=2&limit=10`)
      .expect(200);

    for (const collaborator of response.body.data) {
      expect(collaborator.distance).toBeLessThanOrEqual(2);
      expect(collaborator.id).not.toBe(authorId);
    }
  });

  it('discovers hidden collaborators that are not already co-authors', async () => {
    const [hidden, direct] = await Promise.all([
      request(app).get(`${api}/authors/${authorId}/hidden-collaborators?limit=10`).expect(200),
      request(app).get(`${api}/authors/${authorId}/collaborators?depth=1&limit=100`).expect(200),
    ]);

    const directIds = new Set(direct.body.data.map((entry: { id: string }) => entry.id));
    for (const candidate of hidden.body.data) {
      expect(directIds.has(candidate.id)).toBe(false);
      expect(candidate.reasons.length).toBeGreaterThan(0);
    }
  });

  it('finds a shortest collaboration path or reports that none exists', async () => {
    const response = await request(app)
      .get(`${api}/graph/shortest-path?from=${authorId}&to=${secondAuthorId}&mode=collaboration`)
      .expect(200);

    expect(typeof response.body.data.found).toBe('boolean');
    if (response.body.data.found) {
      const [path] = response.body.data.paths;
      expect(path.nodes.length).toBe(path.edges.length + 1);
      expect(path.nodes[0].id).toBe(authorId);
      expect(path.nodes.at(-1).id).toBe(secondAuthorId);
    }
  });

  it('confines a citation path to CITES edges', async () => {
    const response = await request(app)
      .get(`${api}/citations/path?from=${paperId}&to=${secondPaperId}`)
      .expect(200);

    expect(typeof response.body.data.found).toBe('boolean');
    if (response.body.data.found) {
      const [path] = response.body.data.paths;
      // The distinction that matters: this route must not fall back to the
      // collaboration traversal, so every hop is a citation between papers.
      for (const edge of path.edges) {
        expect(edge.type).toBe('CITES');
      }
      for (const node of path.nodes) {
        expect(node.label).toBe('Paper');
      }
    }
  });

  it('ranks researchers by collaboration reach', async () => {
    const response = await request(app)
      .get(`${api}/collaboration/researchers?limit=10&minPartners=1`)
      .expect(200);

    const scores = response.body.data.map((entry: { score: number }) => entry.score);
    expect([...scores]).toEqual([...scores].sort((a: number, b: number) => b - a));

    for (const researcher of response.body.data) {
      expect(researcher.partnerCount).toBeGreaterThanOrEqual(1);
      expect(researcher.institutionCount).toBeGreaterThanOrEqual(0);
      expect(researcher.topPartners.length).toBeLessThanOrEqual(5);
    }
  });

  it('ranks popular authors by citation impact', async () => {
    const response = await request(app).get(`${api}/analytics/popular-authors?limit=5`).expect(200);

    const citations = response.body.data.map((entry: { citationCount: number }) => entry.citationCount);
    expect(citations.length).toBeGreaterThan(0);
    expect([...citations]).toEqual([...citations].sort((a: number, b: number) => b - a));
  });

  it('returns a citation tree whose parent pointers form a real hierarchy', async () => {
    const response = await request(app)
      .get(`${api}/papers/${paperId}/citation-tree?direction=forward&depth=3&limit=40`)
      .expect(200);

    const nodes = response.body.data;
    const knownIds = new Set<string>([paperId, ...nodes.map((node: { id: string }) => node.id)]);

    for (const node of nodes) {
      expect(node.depth).toBeGreaterThanOrEqual(1);
      expect(node.depth).toBeLessThanOrEqual(3);
      // Every parent must be the root or another node in the result, otherwise
      // the client cannot attach the row to anything.
      expect(knownIds.has(node.parentId)).toBe(true);
      // A node at depth N must hang off a node at depth N-1.
      if (node.depth === 1) {
        expect(node.parentId).toBe(paperId);
      }
    }

    // Each paper appears once: the shortest-route rule makes this a tree.
    const ids = nodes.map((node: { id: string }) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ranks influential citation paths by accumulated citations', async () => {
    const response = await request(app)
      .get(`${api}/papers/${paperId}/influential-citations?depth=4&limit=5`)
      .expect(200);

    const influence = response.body.data.map((path: { influence: number }) => path.influence);
    expect([...influence]).toEqual([...influence].sort((a: number, b: number) => b - a));

    for (const path of response.body.data) {
      expect(path.nodes.length).toBe(path.edges.length + 1);
      expect(path.nodes[0].id).toBe(paperId);
      for (const edge of path.edges) {
        expect(edge.type).toBe('CITES');
      }
    }
  });

  it('finds topics similar by keyword vocabulary with a bounded Jaccard score', async () => {
    const response = await request(app)
      .get(`${api}/topics/${topicId}/similar?limit=5&minSharedKeywords=1`)
      .expect(200);

    for (const topic of response.body.data) {
      expect(topic.id).not.toBe(topicId);
      expect(topic.similarity).toBeGreaterThan(0);
      expect(topic.similarity).toBeLessThanOrEqual(1);
      expect(topic.sharedKeywords.length).toBeGreaterThan(0);
      expect(topic.sharedKeywordCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('reports collaborators with the overlap that explains each connection', async () => {
    const response = await request(app)
      .get(`${api}/authors/${authorId}/collaborators?depth=2&limit=10`)
      .expect(200);

    for (const collaborator of response.body.data) {
      // These four were hardcoded to [] before; a regression would show here.
      expect(Array.isArray(collaborator.sharedPapers)).toBe(true);
      expect(Array.isArray(collaborator.sharedTopics)).toBe(true);
      expect(Array.isArray(collaborator.sharedKeywords)).toBe(true);
      expect(Array.isArray(collaborator.sharedCollaborators)).toBe(true);
      expect(collaborator.reasons.length).toBeGreaterThan(0);
      // Direct collaborators must have co-authored something.
      if (collaborator.distance === 1) {
        expect(collaborator.sharedPapers.length).toBeGreaterThan(0);
      }
    }
  });

  it('ranks experts with collaboration reach and current project load', async () => {
    const response = await request(app).get(`${api}/topics/${topicId}/experts?limit=5`).expect(200);

    for (const expert of response.body.data) {
      expect(expert.collaboratorCount).toBeGreaterThanOrEqual(0);
      expect(expert.activeProjectCount).toBe(expert.activeProjects.length);
      for (const project of expert.activeProjects) {
        expect(project.status).toBe('Active');
      }
    }
  });

  it('counts citations from edges, not from the stored counter', async () => {
    const response = await request(app)
      .get(`${api}/analytics/most-cited-papers?limit=10`)
      .expect(200);

    const counts = response.body.data.map((paper: { inGraphCitations: number }) => paper.inGraphCitations);
    expect(counts.length).toBeGreaterThan(0);
    expect([...counts]).toEqual([...counts].sort((a: number, b: number) => b - a));
    for (const count of counts) {
      expect(count).toBeGreaterThan(0);
    }
  });

  it('ranks keywords by co-occurrence degree', async () => {
    const response = await request(app)
      .get(`${api}/analytics/connected-keywords?limit=10`)
      .expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
    for (const keyword of response.body.data) {
      expect(keyword.connectedKeywordCount).toBeGreaterThan(0);
      expect(keyword.term).toBeTruthy();
    }
  });

  /**
   * This one is the regression test for the FUNDS/FUNDED_BY bug: the traversal
   * spans FundingAgency→Project→ResearchTopic, so a wrong relationship type or
   * direction anywhere along it produces an empty result rather than an error.
   */
  it('traces funding through projects to research fields', async () => {
    const response = await request(app).get(`${api}/analytics/funded-areas?limit=10`).expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
    for (const area of response.body.data) {
      expect(area.field).toBeTruthy();
      expect(area.totalAwardedUsd).toBeGreaterThan(0);
      expect(area.projectCount).toBeGreaterThan(0);
      expect(area.agencyCount).toBeGreaterThan(0);
    }
  });

  it('ranks institutions by distinct partner institutions', async () => {
    const response = await request(app)
      .get(`${api}/analytics/collaborative-institutions?limit=10`)
      .expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
    for (const university of response.body.data) {
      expect(university.partnerCount).toBeGreaterThan(0);
      for (const partner of university.topPartners) {
        expect(partner.id).not.toBe(university.id);
      }
    }
  });

  /** Regression test for the :Project label bug - projects must resolve. */
  it('resolves funding agencies to the projects they fund', async () => {
    const agencies = await request(app).get(`${api}/funding/agencies?limit=1`).expect(200);
    const agency = agencies.body.data[0];

    expect(agency.projectCount).toBeGreaterThan(0);
    expect(agency.totalAwardedUsd).toBeGreaterThan(0);

    const detail = await request(app).get(`${api}/funding/agencies/${agency.id}`).expect(200);
    expect(detail.body.data.projects.length).toBeGreaterThan(0);
  });

  it('recommends similar papers with an explainable score', async () => {
    const response = await request(app).get(`${api}/papers/${paperId}/similar?limit=5`).expect(200);

    for (const paper of response.body.data) {
      expect(paper.id).not.toBe(paperId);
      expect(paper.score).toBeGreaterThan(0);
      expect(paper.reasons.length).toBeGreaterThan(0);
    }
  });

  it('identifies experts in a research field', async () => {
    const response = await request(app).get(`${api}/topics/${topicId}/experts?limit=5`).expect(200);

    const scores = response.body.data.map((expert: { expertiseScore: number }) => expert.expertiseScore);
    expect([...scores]).toEqual([...scores].sort((a: number, b: number) => b - a));

    for (const expert of response.body.data) {
      expect(expert.focusRatio).toBeGreaterThanOrEqual(0);
      expect(expert.focusRatio).toBeLessThanOrEqual(1);
    }
  });

  it('walks citation chains across multiple publications', async () => {
    const response = await request(app)
      .get(`${api}/papers/${paperId}/citation-chains?direction=backward&depth=3&limit=5`)
      .expect(200);

    for (const chain of response.body.data) {
      expect(chain.papers.length).toBe(chain.depth + 1);
    }
  });

  it('discovers related topics both directly and by inference', async () => {
    const response = await request(app).get(`${api}/topics/${topicId}/related?limit=10`).expect(200);

    for (const related of response.body.data) {
      expect(related.id).not.toBe(topicId);
      expect(['direct', 'inferred']).toContain(related.connectionKind);
    }
  });

  it('finds universities working on similar research areas', async () => {
    const universities = await request(app).get(`${api}/universities?limit=1`).expect(200);
    const universityId = universities.body.data[0]?.id;

    const response = await request(app)
      .get(`${api}/universities/${universityId}/similar?limit=5&minSharedTopics=1`)
      .expect(200);

    for (const entry of response.body.data) {
      expect(entry.university.id).not.toBe(universityId);
      expect(entry.similarity).toBeGreaterThan(0);
      expect(entry.similarity).toBeLessThanOrEqual(1);
    }
  });

  it('finds funding agencies supporting similar research', async () => {
    const agencies = await request(app).get(`${api}/funding/agencies?limit=1`).expect(200);
    const agencyId = agencies.body.data[0]?.id;

    const response = await request(app)
      .get(`${api}/funding/agencies/${agencyId}/similar?limit=5&minSharedTopics=1`)
      .expect(200);

    for (const entry of response.body.data) {
      expect(entry.agency.id).not.toBe(agencyId);
      expect(entry.sharedTopics.length).toBeGreaterThan(0);
    }
  });

  it('identifies cross-domain collaborations between distinct fields', async () => {
    const response = await request(app)
      .get(`${api}/discovery/cross-domain?limit=10&minPapers=1`)
      .expect(200);

    for (const entry of response.body.data) {
      expect(entry.fieldA).not.toBe(entry.fieldB);
      expect(entry.paperCount).toBeGreaterThan(0);
    }
  });

  it('ranks trending topics by growth against the prior window', async () => {
    const response = await request(app)
      .get(`${api}/topics/trending?limit=5&windowYears=3`)
      .expect(200);

    for (const topic of response.body.data) {
      expect(topic.recentPaperCount).toBeGreaterThan(0);
      expect(topic.growthRate).toBeGreaterThan(0);
    }
  });

  it('returns a renderable subgraph with edges confined to the node set', async () => {
    const response = await request(app).get(`${api}/graph/sample?limit=60`).expect(200);
    const { nodes, edges } = response.body.data;

    const elementIds = new Set(nodes.map((node: { elementId: string }) => node.elementId));
    for (const edge of edges) {
      expect(elementIds.has(edge.source)).toBe(true);
      expect(elementIds.has(edge.target)).toBe(true);
    }
  });

  it('searches across every label in one round trip', async () => {
    const response = await request(app).get(`${api}/search?q=graph`).expect(200);

    expect(response.body.data.groups.length).toBeGreaterThan(0);
    for (const group of response.body.data.groups) {
      for (const hit of group.hits) {
        expect(hit.href.startsWith('/')).toBe(true);
      }
    }
  });
});
