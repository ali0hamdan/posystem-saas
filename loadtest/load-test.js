/*
 * k6 load & stress test for the Nezhin POS API.
 *
 * Usage (install k6 first: https://k6.io/docs/get-started/installation/):
 *
 *   # Smoke (1 user, sanity):
 *   k6 run -e SCENARIO=smoke loadtest/load-test.js
 *
 *   # Average load (ramp to 50 VUs):
 *   k6 run -e SCENARIO=load loadtest/load-test.js
 *
 *   # Stress (ramp until it hurts):
 *   k6 run -e SCENARIO=stress loadtest/load-test.js
 *
 *   # Spike:
 *   k6 run -e SCENARIO=spike loadtest/load-test.js
 *
 * Configure target + credentials via env vars:
 *   -e BASE_URL=http://localhost:3000
 *   -e USERNAME=owner -e PASSWORD='YourPass' -e CLIENT_SLUG=my-store
 *   -e BRANCH_ID=<branchId>     (needed for /products and /sales)
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const USERNAME = __ENV.USERNAME || 'owner';
const PASSWORD = __ENV.PASSWORD || 'ChangeMe123!';
const CLIENT_SLUG = __ENV.CLIENT_SLUG || '';
const BRANCH_ID = __ENV.BRANCH_ID || '';
const SCENARIO = __ENV.SCENARIO || 'smoke';

const loginTrend = new Trend('login_duration', true);
const productsTrend = new Trend('products_duration', true);
const errorRate = new Rate('business_errors');

const SCENARIOS = {
  smoke: { executor: 'constant-vus', vus: 1, duration: '30s' },
  load: {
    executor: 'ramping-vus', startVUs: 0,
    stages: [
      { duration: '1m', target: 50 },
      { duration: '3m', target: 50 },
      { duration: '1m', target: 0 },
    ],
  },
  stress: {
    executor: 'ramping-vus', startVUs: 0,
    stages: [
      { duration: '2m', target: 100 },
      { duration: '3m', target: 200 },
      { duration: '3m', target: 400 },
      { duration: '2m', target: 0 },
    ],
  },
  spike: {
    executor: 'ramping-vus', startVUs: 0,
    stages: [
      { duration: '10s', target: 300 },
      { duration: '1m', target: 300 },
      { duration: '10s', target: 0 },
    ],
  },
};

export const options = {
  scenarios: { [SCENARIO]: SCENARIOS[SCENARIO] || SCENARIOS.smoke },
  thresholds: {
    http_req_failed: ['rate<0.01'],          // <1% transport failures
    http_req_duration: ['p(95)<800'],        // 95% of requests under 800ms
    login_duration: ['p(95)<1500'],          // login is bcrypt-bound, allow more
    business_errors: ['rate<0.05'],
  },
};

function login() {
  const payload = { username: USERNAME, password: PASSWORD };
  if (CLIENT_SLUG) payload.clientSlug = CLIENT_SLUG;
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'POST /auth/login' },
  });
  loginTrend.add(res.timings.duration);
  const ok = check(res, { 'login 200/201': (r) => r.status === 200 || r.status === 201 });
  errorRate.add(!ok);
  try { return JSON.parse(res.body).accessToken; } catch (_e) { return null; }
}

export default function () {
  group('health', () => {
    const res = http.get(`${BASE_URL}/health`, { tags: { name: 'GET /health' } });
    check(res, { 'health 200': (r) => r.status === 200 });
  });

  const token = login();
  if (!token) { sleep(1); return; }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (BRANCH_ID) authHeaders['X-Branch-Id'] = BRANCH_ID;

  group('browse products', () => {
    const res = http.get(`${BASE_URL}/products?page=1&limit=20`, {
      headers: authHeaders,
      tags: { name: 'GET /products' },
    });
    productsTrend.add(res.timings.duration);
    const ok = check(res, { 'products 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });

  sleep(Math.random() * 2 + 1); // 1-3s think time per virtual user
}
