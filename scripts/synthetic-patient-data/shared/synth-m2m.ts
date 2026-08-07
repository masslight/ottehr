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
import { FHIR_IDENTIFIER_NPI } from 'utils';
import { makeValidNpi } from './npi';
import { createOystehrFromToken, mintAccessTokenForClient } from './oystehr-client';

// Marker tag + identifier for the DEDICATED Practitioner used as the M2M profile.
const STAFF_MARKER_SYSTEM = 'https://fhir.ottehr.com/sid/synth-staff';
const PROFILE_ID_SYSTEM = 'https://fhir.ottehr.com/sid/synth-m2m-profile';

// Grant the synth M2M full staff roles — same as the integration-test provider
// client (integration-global-setup.ts) — so role/policy-gated zambdas like
// sign-appointment authorize it. Names include both spaced and unspaced variants
// so it matches whatever the project defines; only existing roles are applied.
const STAFF_ROLE_NAMES = new Set([
  'Provider',
  'Administrator',
  'Manager',
  'Staff',
  'Billing',
  'Customer Support',
  'CustomerSupport',
  'Front Desk',
  'FrontDesk',
]);
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

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

// The M2M's profile must be a Practitioner not already bound to another principal:
// a Practitioner ↔ principal is 1:1, so reusing a synth-STAFF provider (already a
// staff User's profile) fails with "Profile ... is already in use". Use a
// DEDICATED, otherwise-unused Practitioner per M2M — find-or-create by a stable
// identifier — exactly as the integration tests make a throwaway Practitioner for
// their M2M. This Practitioner is the chart-data author (the synthesizer /
// registrar), which is the intended attribution per POPULATION.md.
async function ensureProfilePractitioner(admin: Oystehr, m2mName: string, override?: string): Promise<string> {
  if (override) return override;
  const idValue = slug(m2mName);
  // Signing + order zambdas require the caller's Practitioner to carry an NPI
  // (assertPractitionerHasNPI → NOT_AUTHORIZED), so the profile Practitioner gets a
  // deterministic checksum-valid one.
  const npi = makeValidNpi(idValue);
  const existing = (
    await admin.fhir.search<any>({
      resourceType: 'Practitioner',
      params: [{ name: 'identifier', value: `${PROFILE_ID_SYSTEM}|${idValue}` }],
    })
  ).unbundle();
  if (existing[0]?.id) {
    // Self-heal a previously-created profile Practitioner that predates the NPI
    // requirement (added below), so sign-appointment stops 401-ing on it.
    const p = existing[0] as { id: string; identifier?: Array<{ system?: string }> };
    if (!(p.identifier ?? []).some((i) => i.system === FHIR_IDENTIFIER_NPI)) {
      await admin.fhir.patch<any>({
        resourceType: 'Practitioner',
        id: p.id,
        operations: [{ op: 'add', path: '/identifier/-', value: { system: FHIR_IDENTIFIER_NPI, value: npi } }],
      });
    }
    return p.id;
  }
  const created = await admin.fhir.create<any>({
    resourceType: 'Practitioner',
    active: true,
    identifier: [
      { system: PROFILE_ID_SYSTEM, value: idValue },
      { system: FHIR_IDENTIFIER_NPI, value: npi },
    ],
    meta: { tag: [{ system: STAFF_MARKER_SYSTEM, code: 'synth-m2m-profile' }] },
    name: [{ use: 'official', family: 'Synthesizer', given: ['Synth'] }],
  });
  return created.id as string;
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

  // Grant the synth M2M the project's staff roles (Provider + admin/manager/etc.).
  // Roles carry the comprehensive access policies a staff USER has — needed for
  // role/policy-gated zambdas like sign-appointment (a narrow copied policy 401s
  // "not authorized"). Only roles the project actually defines are applied.
  const allRoles = (await admin.role.list()) as Array<{ id: string; name: string }>;
  const roleIds = allRoles.filter((r) => STAFF_ROLE_NAMES.has(r.name)).map((r) => r.id);
  if (roleIds.length === 0) {
    throw new Error(
      `[synth-m2m] no staff roles found on the project (looked for: ${[...STAFF_ROLE_NAMES].join(', ')}).`
    );
  }

  const clients = (await admin.m2m.list()) as any[];
  const practitionerId = await ensureProfilePractitioner(admin, opts.name, opts.practitionerId);
  // Recreate (delete-then-create) rather than update: an m2m.update({ roles })
  // leaves any inline accessPolicy from a prior (pre-roles) run in place, which can
  // override the roles and cause 403s ("Forbidden"). A fresh create guarantees a
  // clean roles-only client. Nothing external references the old client (we mint
  // its secret fresh each run anyway), so deleting it is safe.
  const existing = clients.find((c) => c.name === opts.name);
  if (existing) await admin.m2m.delete({ id: existing.id });
  const created = (await admin.m2m.create({
    name: opts.name,
    description: 'Synth pipeline client (Practitioner profile + staff roles) — provisioned in-process.',
    profile: `Practitioner/${practitionerId}`,
    roles: roleIds,
  })) as any;
  const id: string = created.id;
  const clientId: string = created.clientId;

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
