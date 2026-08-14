// One M2M token is valid for far longer than a suite run, but every spec file that constructs a
// ResourceHandler at module scope fetches its own — which, across workers and files, cost ~99 Auth0
// round trips per EHR E2E run. Memoize per worker process. The promise (not the resolved value) is
// cached so concurrent callers during module import share a single in-flight request.
let cachedToken: Promise<string> | undefined;

export function getAuth0Token(): Promise<string> {
  if (!cachedToken) {
    // Drop a rejected token so a transient Auth0 failure doesn't poison the whole worker.
    cachedToken = fetchAuth0Token().catch((error) => {
      cachedToken = undefined;
      throw error;
    });
  }
  return cachedToken;
}

async function fetchAuth0Token(): Promise<string> {
  const AUTH0_ENDPOINT = process.env.AUTH0_ENDPOINT;
  let AUTH0_CLIENT: string;
  let AUTH0_SECRET: string;
  if (!AUTH0_ENDPOINT || !process.env.AUTH0_CLIENT || !process.env.AUTH0_SECRET) {
    throw new Error('❌ Missing auth0 credentials');
  }
  if (process.env.AUTH0_CLIENT_TESTS && process.env.AUTH0_SECRET_TESTS) {
    AUTH0_CLIENT = process.env.AUTH0_CLIENT_TESTS;
    AUTH0_SECRET = process.env.AUTH0_SECRET_TESTS;
  } else {
    AUTH0_CLIENT = process.env.AUTH0_CLIENT;
    AUTH0_SECRET = process.env.AUTH0_SECRET;
  }
  const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

  if (!AUTH0_ENDPOINT || !AUTH0_CLIENT || !AUTH0_SECRET || !AUTH0_AUDIENCE) {
    throw new Error('❌ Missing auth0 credentials');
  }

  try {
    console.log(`Fetching auth0 token...`);
    const response = await fetch(AUTH0_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: AUTH0_CLIENT,
        client_secret: AUTH0_SECRET,
        audience: AUTH0_AUDIENCE,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('Got auth0 token');
    return (await response.json()).access_token;
  } catch (error: any) {
    console.error('❌ Failed to get auth0 token', error);
    throw new Error(error.message);
  }
}
