import { config } from '../config/index.js';

const startedAt = Date.now();

export interface LivenessReport {
  status: 'ok';
  uptimeSeconds: number;
  environment: string;
  version: string;
}

/**
 * Liveness: is this process running?
 *
 * Deliberately does not touch the database. A platform health check pointed
 * here will never restart a healthy API just because the graph is briefly
 * unreachable - which is exactly the restart loop this separation prevents.
 */
export function checkLiveness(): LivenessReport {
  return {
    status: 'ok',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    environment: config.env,
    version: '1.0.0',
  };
}

export function uptimeSeconds(): number {
  return Math.round((Date.now() - startedAt) / 1000);
}
