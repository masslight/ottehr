// M2M token for the eval tools.
//
// The endpoints accept a `client_credentials` token whose client id matches the project's AUTH0_CLIENT:
// a service client has no user profile and could never pass the role check, so it is recognised and the
// check is skipped. Minting here means a run is one command with the secrets file, instead of copying a
// token by hand and re-copying it when it expires.
//
//   npx env-cmd -f packages/zambdas/.env/zambda-secrets-local.json npx tsx tools/easy-chart-eval/<tool>.ts

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Run under the zambda secrets, e.g.\n` +
        '  npx env-cmd -f packages/zambdas/.env/zambda-secrets-local.json npx tsx tools/easy-chart-eval/<tool>.ts'
    );
  }
  return value;
}

export async function mintToken(): Promise<string> {
  const response = await fetch(requireEnv('AUTH0_ENDPOINT'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: requireEnv('AUTH0_CLIENT'),
      client_secret: requireEnv('AUTH0_SECRET'),
      audience: requireEnv('AUTH0_AUDIENCE'),
      grant_type: 'client_credentials',
    }),
  });
  if (!response.ok) throw new Error(`auth failed: ${response.status} ${(await response.text()).slice(0, 200)}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

/**
 * Mirrors projectApiUrlFromAuth0Audience / fhirApiUrlFromAuth0Audience in
 * packages/zambdas/src/shared/helpers.ts. Kept local rather than imported because that module pulls the
 * whole zambda secrets surface in behind it; if the canonical mapping gains an environment, add it here.
 */
export function apiUrls(): { projectApiUrl: string; fhirApiUrl: string } {
  const audience = requireEnv('AUTH0_AUDIENCE').replace(/\/$/, '');
  const match = /^https:\/\/([a-z0-9]*\.)?api\.zapehr\.com$/.exec(audience);
  if (!match) throw new Error(`cannot map AUTH0_AUDIENCE "${audience}" to API urls`);
  const prefix = match[1] ?? '';
  return {
    projectApiUrl: `https://${prefix}project-api.zapehr.com/v1`,
    fhirApiUrl: `https://${prefix}fhir-api.zapehr.com`,
  };
}
