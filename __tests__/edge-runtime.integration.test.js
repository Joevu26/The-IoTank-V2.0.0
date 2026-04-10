/*
 * Runtime integration tests for local Supabase Edge Functions.
 *
 * Opt-in to avoid flaky CI/dev runs:
 *   RUN_EDGE_INTEGRATION=1 npm run test:integration:edge
 *
 * Optional env:
 *   SUPABASE_EDGE_BASE_URL=http://127.0.0.1:54321/functions/v1
 *   SUPABASE_ANON_KEY=...
 */

const RUN_EDGE = process.env.RUN_EDGE_INTEGRATION === '1';
const BASE_URL = process.env.SUPABASE_EDGE_BASE_URL || 'http://127.0.0.1:54321/functions/v1';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || BASE_URL.replace(/\/functions\/v1$/, '');
const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || '';
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';
const TEST_PENDING_REGISTRATION_ID = process.env.TEST_PENDING_REGISTRATION_ID || '';
const TEST_PENDING_INVITATION_ID = process.env.TEST_PENDING_INVITATION_ID || '';

const maybeDescribe = RUN_EDGE ? describe : describe.skip;

async function callEdge(functionName, method = 'POST', body) {
  const headers = { 'Content-Type': 'application/json' };
  if (ANON_KEY) headers.apikey = ANON_KEY;

  const response = await fetch(`${BASE_URL}/${functionName}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_e) {
    payload = null;
  }

  return { response, payload };
}

async function getAdminAccessToken() {
  if (!TEST_ADMIN_EMAIL || !TEST_ADMIN_PASSWORD || !ANON_KEY) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
    },
    body: JSON.stringify({
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) return null;
  return payload.access_token;
}

async function callEdgeAsAdmin(functionName, body, accessToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (ANON_KEY) headers.apikey = ANON_KEY;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(`${BASE_URL}/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  return { response, payload };
}

maybeDescribe('Edge runtime integration (local Supabase)', () => {
  jest.setTimeout(20000);

  test('verify-recaptcha rejects malformed token payload', async () => {
    const { response, payload } = await callEdge('verify-recaptcha', 'POST', { token: 'bad' });

    expect([400, 401]).toContain(response.status);
    if (payload && typeof payload === 'object') {
      expect(payload.success).toBe(false);
    }
  });

  test('news-api-proxy rejects missing URL payload', async () => {
    const { response, payload } = await callEdge('news-api-proxy', 'POST', {});

    expect([400, 401]).toContain(response.status);
    if (payload && typeof payload === 'object') {
      expect(payload.success === false || !!payload.error).toBe(true);
    }
  });

  test('gemini-proxy rejects missing body payload', async () => {
    const { response, payload } = await callEdge('gemini-proxy', 'POST', {});

    expect([400, 401]).toContain(response.status);
    if (payload && typeof payload === 'object') {
      expect(payload.success === false || !!payload.error).toBe(true);
    }
  });

  test('approve-invitation requires authorization', async () => {
    const { response, payload } = await callEdge('approve-invitation', 'POST', {
      invitationId: '00000000-0000-0000-0000-000000000000'
    });

    // Without bearer auth, endpoint must not succeed.
    expect([401, 403]).toContain(response.status);
    if (payload && typeof payload === 'object') {
      expect(!!payload.error).toBe(true);
    }
  });
});

const canRunAuthSuccessPath =
  RUN_EDGE &&
  !!TEST_ADMIN_EMAIL &&
  !!TEST_ADMIN_PASSWORD &&
  !!TEST_PENDING_REGISTRATION_ID &&
  !!TEST_PENDING_INVITATION_ID &&
  !!ANON_KEY;

(canRunAuthSuccessPath ? describe : describe.skip)('Edge auth success-path integration', () => {
  jest.setTimeout(30000);

  test('approve-registration succeeds with local admin JWT', async () => {
    const token = await getAdminAccessToken();
    expect(token).toBeTruthy();

    const { response, payload } = await callEdgeAsAdmin(
      'approve-registration',
      { registrationId: TEST_PENDING_REGISTRATION_ID },
      token
    );

    expect(response.status).toBe(200);
    expect(payload?.success).toBe(true);
    expect(payload?.userId).toBeTruthy();
  });

  test('approve-invitation succeeds with local admin JWT', async () => {
    const token = await getAdminAccessToken();
    expect(token).toBeTruthy();

    const { response, payload } = await callEdgeAsAdmin(
      'approve-invitation',
      { invitationId: TEST_PENDING_INVITATION_ID },
      token
    );

    expect(response.status).toBe(200);
    expect(payload?.success).toBe(true);
    expect(payload?.userId).toBeTruthy();
  });
});
