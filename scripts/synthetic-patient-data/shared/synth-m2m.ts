// In-process provisioning of a dedicated Practitioner-profile M2M for the synth
// pipeline — the same shape the integration tests use (see
// packages/zambdas/test/helpers/integration-global-setup.ts): provision under an
// admin client, mint/rotate in memory, act as it. NOTHING is written to disk or
// the secrets repo, and the project's existing M2M is left untouched.
//
// Why it's needed: save-chart-data resolves the caller via oystehr.m2m.me() and
// loads its `profile` as a Practitioner (packages/utils/lib/auth/user-me.helper.ts).
// The default project M2M has a `Device/...` profile → save-chart-data 500s. This
// creates/updates a SEPARATE client whose profile is a real Practitioner (access
// policy copied from the current pipeline client, so same perms), then REDIRECTS
// this process to authenticate as it by overwriting AUTH0_CLIENT/AUTH0_SECRET in
// process.env — which spawned harness children inherit.
import type Oystehr from '@oystehr/sdk';
import { createOystehrFromToken, mintAccessTokenForClient, searchAllPages } from './oystehr-client';

// Mirrors the tags link-synth-staff-users.ts writes (kept in sync intentionally).
const STAFF_MARKER_SYSTEM = 'https://fhir.ottehr.com/sid/synth-staff';
const ROLE_SYSTEM = 'https://fhir.ottehr.com/sid/synth-staff-role';

// Resolve an admin-privileged token (needs IAM: m2m list/create/update/rotate).
// Returns null when no admin creds are provided — the caller then keeps the env
// M2M as-is (fine if it's already a Practitioner-profile client; otherwise
// save-chart-data will 500 and the operator must supply admin creds).
async function adminToken(): Promise<string | null> {
  if (process.env.OYSTEHR_ACCESS_TOKEN) return process.env.OYSTEHR_ACCESS_TOKEN;
  const id = process.env.OYSTEHR_ADMIN_CLIENT_ID;
  const secret = process.env.OYSTEHR_ADMIN_CLIENT_SECRET;
  if (id && secret) return mintAccessTokenForClient(id, secret);
  return null;
}

async function pickPractitionerId(admin: Oystehr, override?: string): Promise<string> {
  if (override) return override;
  // Prefer a synth-staff provider; fall back to any Practitioner on the project.
  const synth = await searchAllPages<any>(admin, 'Practitioner', [
    { name: '_tag', value: `${STAFF_MARKER_SYSTEM}|synth-staff` },
  ]);
  const provider =
    synth.find((p: any) => (p.meta?.tag ?? []).some((t: any) => t.system === ROLE_SYSTEM && t.code === 'provider')) ??
    synth[0];
  if (provider?.id) return provider.id as string;
  const anyPrac = (
    await admin.fhir.search<any>({ resourceType: 'Practitioner', params: [{ name: '_count', value: '1' }] })
  ).unbundle();
  if (anyPrac[0]?.id) return anyPrac[0].id as string;
  throw new Error(
    '[synth-m2m] no Practitioner found for the M2M profile — run link-synth-staff-users.ts first, or pass a practitionerId.'
  );
}

export interface SynthM2M {
  clientId: string;
  secret: string;
  profile: string;
}

/**
 * Ensure the dedicated Practitioner-profile M2M `name` exists (find-or-create,
 * profile + access-policy kept correct), rotate its secret, and redirect THIS
 * process to authenticate as it (overwrites AUTH0_CLIENT/AUTH0_SECRET in
 * process.env; spawned children inherit it). Returns null when no admin creds are
 * present (no-op — the env M2M is used unchanged).
 *
 * seed and census pass DIFFERENT names so their runs never rotate each other's
 * secret out from under an in-flight run.
 */
export async function ensureSynthM2MInProcess(opts: {
  name: string;
  practitionerId?: string;
}): Promise<SynthM2M | null> {
  const token = await adminToken();
  if (!token) {
    console.log(
      '[synth-m2m] no admin creds (OYSTEHR_ADMIN_CLIENT_ID/SECRET or OYSTEHR_ACCESS_TOKEN) — using the env M2M as-is; ' +
        'save-chart-data will 500 unless that client already has a Practitioner profile.'
    );
    return null;
  }
  const admin = createOystehrFromToken(token);

  // The current pipeline client (from the env) is the reference whose access
  // policy we copy — it can already do everything the pipeline needs; only its
  // profile is wrong. Capture it BEFORE we overwrite the env below.
  const referenceClientId = process.env.AUTH0_CLIENT;
  const clients = (await admin.m2m.list()) as any[];
  const reference = referenceClientId ? clients.find((c) => c.clientId === referenceClientId) : undefined;
  if (!reference?.accessPolicy) {
    throw new Error(
      `[synth-m2m] reference M2M (clientId ${
        referenceClientId ?? '<unset>'
      }) not found or has no inline accessPolicy to copy.`
    );
  }

  const practitionerId = await pickPractitionerId(admin, opts.practitionerId);
  const existing = clients.find((c) => c.name === opts.name);
  let id: string;
  let clientId: string;
  if (existing) {
    await admin.m2m.update({
      id: existing.id,
      profile: `Practitioner/${practitionerId}`,
      accessPolicy: reference.accessPolicy,
    });
    id = existing.id;
    clientId = existing.clientId;
  } else {
    const created = (await admin.m2m.create({
      name: opts.name,
      description: 'Synth pipeline client (Practitioner profile) — provisioned in-process by ensureSynthM2MInProcess.',
      profile: `Practitioner/${practitionerId}`,
      accessPolicy: reference.accessPolicy,
    })) as any;
    id = created.id;
    clientId = created.clientId;
  }

  const { secret } = await admin.m2m.rotateSecret({ id });
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::add-mask::${secret}`);
    console.log(`::add-mask::${clientId}`);
  }

  // Redirect this process (and its spawned harness children, which inherit
  // process.env) to authenticate as the synth M2M. No file / secrets-repo write.
  process.env.AUTH0_CLIENT = clientId;
  process.env.AUTH0_SECRET = secret;
  console.log(
    `[synth-m2m] authenticating as "${opts.name}" (profile=Practitioner/${practitionerId}); existing project M2M untouched.`
  );
  return { clientId, secret, profile: `Practitioner/${practitionerId}` };
}
