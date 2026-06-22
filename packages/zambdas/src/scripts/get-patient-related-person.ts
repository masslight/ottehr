import Oystehr from '@oystehr/sdk';
import { Address, ContactPoint, HumanName, Patient, RelatedPerson } from 'fhir/r4b';
import * as readline from 'readline';
import { Writable } from 'stream';
import {
  getFirstName,
  getFullestAvailableName,
  getLastName,
  getPhoneNumberForIndividual,
  getSMSNumberForIndividual,
} from 'utils';

const INDENT = '   ';

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptHidden(question: string): Promise<string> {
  // Fully swallow readline's own echo so typed/pasted characters never reach the
  // terminal in clear text; we render the prompt and the '*' mask ourselves.
  const mutedOutput = new Writable({
    write(_chunk, _encoding, callback): void {
      callback();
    },
  });

  const rl = readline.createInterface({ input: process.stdin, output: mutedOutput, terminal: true });

  const render = (): void => {
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
    process.stdout.write(question + '*'.repeat((rl as unknown as { line: string }).line.length));
  };

  // Print the prompt initially, then re-render (prompt + stars) on every keystroke/paste.
  process.stdout.write(question);
  const onData = (): void => render();
  process.stdin.on('data', onData);

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      process.stdin.removeListener('data', onData);
      process.stdout.write('\n');
      rl.close();
      resolve(answer.trim());
    });
  });
}

function formatName(resource: Patient | RelatedPerson): string {
  const fullest = getFullestAvailableName(resource);
  if (fullest) return fullest;
  const first = getFirstName(resource);
  const last = getLastName(resource);
  return [first, last].filter(Boolean).join(' ') || 'N/A';
}

function formatHumanName(name: HumanName): string {
  const parts = [name.prefix?.join(' '), name.given?.join(' '), name.family, name.suffix?.join(' ')].filter(Boolean);
  const full = parts.join(' ').trim() || name.text || 'N/A';
  const meta = name.use ? ` (use: ${name.use})` : '';
  return `${full}${meta}`;
}

function formatAddress(address: Address): string {
  const lines = [
    ...(address.line ?? []),
    [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
    address.country,
  ].filter(Boolean);
  const full = lines.join(', ') || address.text || 'N/A';
  const meta = [address.use ? `use: ${address.use}` : undefined, address.type ? `type: ${address.type}` : undefined]
    .filter(Boolean)
    .join(', ');
  return meta ? `${full} (${meta})` : full;
}

function formatTelecom(cp: ContactPoint): string {
  const meta = [
    cp.system ? `system: ${cp.system}` : undefined,
    cp.use ? `use: ${cp.use}` : undefined,
    cp.rank !== undefined ? `rank: ${cp.rank}` : undefined,
  ]
    .filter(Boolean)
    .join(', ');
  const value = cp.value ?? 'N/A';
  return meta ? `${value} (${meta})` : value;
}

function printSection(label: string): void {
  console.log(`\n${label}`);
  console.log('='.repeat(50));
}

function printField(label: string, value: string | undefined, indent = INDENT): void {
  console.log(`${indent}${label.padEnd(14)}${value ?? 'N/A'}`);
}

function printNames(names: HumanName[] | undefined, indent = INDENT): void {
  if (!names || names.length === 0) {
    printField('Names:', 'N/A', indent);
    return;
  }
  console.log(`${indent}Names:`);
  names.forEach((name) => console.log(`${indent}  • ${formatHumanName(name)}`));
}

function printAddresses(addresses: Address[] | undefined, indent = INDENT): void {
  if (!addresses || addresses.length === 0) {
    printField('Addresses:', 'N/A', indent);
    return;
  }
  console.log(`${indent}Addresses:`);
  addresses.forEach((address) => console.log(`${indent}  • ${formatAddress(address)}`));
}

function printTelecom(telecom: ContactPoint[] | undefined, indent = INDENT): void {
  if (!telecom || telecom.length === 0) {
    printField('Telecom:', 'N/A', indent);
    return;
  }
  console.log(`${indent}Telecom:`);
  telecom.forEach((cp) => console.log(`${indent}  • ${formatTelecom(cp)}`));
}

async function getPatient(oystehr: Oystehr, patientId: string): Promise<Patient | undefined> {
  try {
    return await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId });
  } catch (error) {
    console.error(`❌ Error fetching Patient ${patientId}:`, error);
    return undefined;
  }
}

async function getRelatedPersons(oystehr: Oystehr, patientId: string): Promise<RelatedPerson[]> {
  try {
    const bundle = await oystehr.fhir.search<RelatedPerson>({
      resourceType: 'RelatedPerson',
      params: [{ name: 'patient', value: `Patient/${patientId}` }],
    });
    return bundle.unbundle();
  } catch (error) {
    console.error(`❌ Error fetching RelatedPerson for patient ${patientId}:`, error);
    return [];
  }
}

async function main(): Promise<void> {
  const token = await promptHidden('Access token: ');
  const projectId = await prompt('Project ID: ');
  const patientId = await prompt('Patient ID: ');

  if (!token || !projectId || !patientId) {
    throw new Error('❌ Access token, project ID, and patient ID are all required.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    projectId,
  });

  const patient = await getPatient(oystehr, patientId);

  if (!patient) {
    console.log(`No patient found for id ${patientId}.`);
    return;
  }

  printSection('👤 Patient');
  printField('ID:', patient.id);
  printField('Name:', formatName(patient));
  printField('DOB:', patient.birthDate);
  printField('Sex:', patient.gender);
  printField('Active:', patient.active === undefined ? undefined : String(patient.active));
  printField('Phone:', getPhoneNumberForIndividual(patient));
  printField('SMS:', getSMSNumberForIndividual(patient));
  printNames(patient.name);
  printTelecom(patient.telecom);
  printAddresses(patient.address);

  const relatedPersons = await getRelatedPersons(oystehr, patientId);

  if (relatedPersons.length === 0) {
    console.log('\n⚠️  No RelatedPerson resources found for this patient.');
    return;
  }

  printSection(`🔗 RelatedPerson(s) — ${relatedPersons.length} found`);

  relatedPersons.forEach((rp, index) => {
    const relationship = rp.relationship
      ?.flatMap((r) => r.coding ?? [])
      .map((c) => c.code ?? c.display)
      .filter(Boolean)
      .join(', ');

    console.log(`\n${INDENT}[${index + 1}] RelatedPerson/${rp.id}`);
    const indent = `${INDENT}    `;
    printField('ID:', rp.id, indent);
    printField('Name:', formatName(rp), indent);
    printField('Relationship:', relationship || undefined, indent);
    printField('DOB:', rp.birthDate, indent);
    printField('Sex:', rp.gender, indent);
    printField('Patient Ref:', rp.patient?.reference, indent);
    printField('Phone:', getPhoneNumberForIndividual(rp), indent);
    printField('SMS:', getSMSNumberForIndividual(rp), indent);
    printNames(rp.name, indent);
    printTelecom(rp.telecom, indent);
    printAddresses(rp.address, indent);
  });

  console.log('');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
