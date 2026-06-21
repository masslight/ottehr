// Create the synth STAFF as EHR users so they appear in Admin → Employees and the provider
// dropdowns — exactly like normal staff, just not loginable (non-deliverable @synth.invalid email).
// oystehr.user.invite REQUIRES a `resource`, so the Practitioner is created as part of the invite
// (you can't link a pre-existing one). The Practitioner carries synth-staff tags so the population
// orchestrator can find/route them. Idempotent: skips any staff whose username already exists.
//
// CREATES USER ACCOUNTS — run it yourself (the harness `!` prefix is fine):
//   npx env-cmd -f packages/zambdas/.env/synth.json \
//   npx tsx scripts/synthetic-patient-data/link-synth-staff-users.ts
// Optional: APPLICATION_ID='<ehr-app-id>' to override application auto-detection.
import Oystehr from '@oystehr/sdk';
import { Practitioner } from 'fhir/r4b';

const need = (n: string): string => {
  const v = process.env[n];
  if (!v) throw new Error('Missing ' + n);
  return v;
};

const STAFF_MARKER_SYSTEM = 'https://fhir.ottehr.com/sid/synth-staff';
const STAFF_ID_SYSTEM = 'https://fhir.ottehr.com/sid/synth-staff-id';
const ROLE_SYSTEM = 'https://fhir.ottehr.com/sid/synth-staff-role';
const LOCATION_SYSTEM = 'https://fhir.ottehr.com/sid/synth-staff-location';

// The EHR treats every Practitioner.qualification as a state license — get-user reads
// qualification.extension[0].extension[1]... so a credential must use this exact license shape
// (mirrors makeQualificationForPractitioner) or the employee detail page 500s.
const QUALIFICATION_EXTENSION_URL =
  'http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/practitioner-qualification';
const QUALIFICATION_CODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0360|2.7';
const QUALIFICATION_STATE_SYSTEM = 'http://hl7.org/fhir/us/core/ValueSet/us-core-usps-state';
const STATE_FOR: Record<string, string> = { 'Los Angeles': 'CA', 'New York': 'NY' };

type Role = 'provider' | 'medical-assistant' | 'front-desk';
// synth has no "Front Desk" role; Staff is the generic non-provider role. Front-desk attribution on
// visits comes from the appointment created-by tag, not this role.
const EHR_ROLE_FOR: Record<Role, string> = {
  provider: 'Provider',
  'medical-assistant': 'Staff',
  'front-desk': 'Staff',
};

interface StaffDef {
  first: string;
  last: string;
  role: Role;
  location: 'Los Angeles' | 'New York';
  credential?: 'MD' | 'DO' | 'NP' | 'PA';
}
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const STAFF: StaffDef[] = [
  { first: 'Maria', last: 'Alvarez', role: 'provider', location: 'Los Angeles', credential: 'MD' },
  { first: 'James', last: 'Okafor', role: 'provider', location: 'Los Angeles', credential: 'DO' },
  { first: 'Priya', last: 'Nair', role: 'provider', location: 'Los Angeles', credential: 'NP' },
  { first: 'Daniel', last: 'Cohen', role: 'provider', location: 'Los Angeles', credential: 'MD' },
  { first: 'Sofia', last: 'Ramirez', role: 'provider', location: 'Los Angeles', credential: 'PA' },
  { first: 'Wei', last: 'Chen', role: 'provider', location: 'Los Angeles', credential: 'MD' },
  { first: 'Aisha', last: 'Patel', role: 'provider', location: 'New York', credential: 'MD' },
  { first: 'Liam', last: "O'Brien", role: 'provider', location: 'New York', credential: 'MD' },
  { first: 'Grace', last: 'Kim', role: 'provider', location: 'New York', credential: 'NP' },
  { first: 'Marcus', last: 'Webb', role: 'provider', location: 'New York', credential: 'DO' },
  { first: 'Elena', last: 'Petrova', role: 'provider', location: 'New York', credential: 'PA' },
  { first: 'Samuel', last: 'Adeyemi', role: 'provider', location: 'New York', credential: 'MD' },
  { first: 'Jasmine', last: 'Lee', role: 'medical-assistant', location: 'Los Angeles' },
  { first: 'Carlos', last: 'Mendez', role: 'medical-assistant', location: 'Los Angeles' },
  { first: 'Tanya', last: 'Robinson', role: 'medical-assistant', location: 'Los Angeles' },
  { first: 'Destiny', last: 'Brooks', role: 'medical-assistant', location: 'New York' },
  { first: 'Omar', last: 'Haddad', role: 'medical-assistant', location: 'New York' },
  { first: 'Lucia', last: 'Romano', role: 'medical-assistant', location: 'New York' },
  { first: 'Brittany', last: 'Foster', role: 'front-desk', location: 'Los Angeles' },
  { first: 'Andre', last: 'Jackson', role: 'front-desk', location: 'Los Angeles' },
  { first: 'Mei', last: 'Lin', role: 'front-desk', location: 'Los Angeles' },
  { first: 'Rachel', last: 'Goldstein', role: 'front-desk', location: 'New York' },
  { first: 'Tyrone', last: 'Washington', role: 'front-desk', location: 'New York' },
  { first: 'Fatima', last: 'Khan', role: 'front-desk', location: 'New York' },
];

function practitionerResource(s: StaffDef): Practitioner {
  return {
    resourceType: 'Practitioner',
    active: true,
    identifier: [{ system: STAFF_ID_SYSTEM, value: `${slug(s.first)}-${slug(s.last)}-${s.role}` }],
    meta: {
      tag: [
        { system: STAFF_MARKER_SYSTEM, code: 'synth-staff' },
        { system: ROLE_SYSTEM, code: s.role },
        { system: LOCATION_SYSTEM, code: s.location },
      ],
    },
    name: [{ use: 'official', family: s.last, given: [s.first] }],
    ...(s.credential
      ? {
          qualification: [
            {
              code: { coding: [{ system: QUALIFICATION_CODE_SYSTEM, code: s.credential }], text: 'Qualification code' },
              extension: [
                {
                  url: QUALIFICATION_EXTENSION_URL,
                  extension: [
                    { url: 'status', valueCode: 'active' },
                    {
                      url: 'whereValid',
                      valueCodeableConcept: {
                        coding: [{ code: STATE_FOR[s.location] ?? 'CA', system: QUALIFICATION_STATE_SYSTEM }],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        }
      : {}),
  };
}

async function main(): Promise<void> {
  // Auth: prefer an explicit OYSTEHR_ACCESS_TOKEN (e.g. a logged-in admin USER's
  // browser bearer token) — needed when the project's M2M client lacks IAM
  // permissions (can't application.list / user.invite). Otherwise mint an M2M
  // token from the env's AUTH0_* creds. Never inline the token — pass it via the
  // env var at call time.
  let accessToken = process.env.OYSTEHR_ACCESS_TOKEN;
  if (accessToken) {
    console.log('Using OYSTEHR_ACCESS_TOKEN (user/admin token).');
  } else {
    const t = await (
      await fetch(need('AUTH0_ENDPOINT'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.AUTH0_CLIENT,
          client_secret: process.env.AUTH0_SECRET,
          audience: process.env.AUTH0_AUDIENCE,
          grant_type: 'client_credentials',
        }),
      })
    ).json();
    accessToken = (t as any).access_token;
  }
  const oystehr = new Oystehr({
    accessToken,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API') },
  });

  let applicationId = process.env.APPLICATION_ID;
  if (!applicationId) {
    const apps = await oystehr.application.list();
    const ehrApp = apps.find((a) => /ehr/i.test(a.name ?? '')) ?? apps[0];
    if (!ehrApp?.id) throw new Error('No applications found; set APPLICATION_ID explicitly.');
    applicationId = ehrApp.id;
    console.log(`Using application "${ehrApp.name}" (${applicationId}). Override with APPLICATION_ID if wrong.`);
  }

  const roles = await oystehr.role.list();
  const roleIdByName = new Map(roles.map((r) => [r.name, r.id]));
  for (const rn of new Set(Object.values(EHR_ROLE_FOR))) {
    if (!roleIdByName.get(rn)) throw new Error(`Required role "${rn}" not found in this project.`);
  }

  const existingUsernames = new Set((await oystehr.user.list()).map((u) => u.name));

  let invited = 0;
  let skipped = 0;
  for (const s of STAFF) {
    const name = `${s.first} ${s.last}${s.credential ? ', ' + s.credential : ''}`;
    if (existingUsernames.has(name)) {
      skipped++;
      continue;
    }
    const roleId = roleIdByName.get(EHR_ROLE_FOR[s.role])!;
    await oystehr.user.invite({
      // Reserved, non-routable address (RFC 2606 .invalid) — looks like a normal employee but no
      // mail server can deliver a set-password/magic-link, so the account can't be logged into.
      email: `${slug(s.first)}.${slug(s.last)}@synth.invalid`,
      username: name,
      applicationId,
      resource: practitionerResource(s),
      roles: [roleId],
    });
    invited++;
    console.log(`  ${EHR_ROLE_FOR[s.role].padEnd(9)} ${s.location.padEnd(12)} ${name}`);
  }
  console.log(`\nDone — invited ${invited}, already-present ${skipped}, total ${STAFF.length}.`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
