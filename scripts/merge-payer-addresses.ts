#!/usr/bin/env ts-node

/**
 * Merge payer addresses & phone numbers from a CSV into FHIR Organization entries in a JSON file,
 * and also emit a CSV of payers that have no match in the JSON or are missing a payer id.
 *
 * - Writes FHIR-compliant addresses:
 *     Organization.address: Address[]
 *     Address.line: string[]
 * - Adds phone numbers into Organization.telecom as ContactPoint entries:
 *     { system: "phone", value: "<phone>" }
 *   (Existing telecom entries are preserved; duplicate phone values are skipped.)
 * - Also writes an "unmatched" CSV with columns:
 *     Payer Id,Name,Address Line 1,City,State,Zip,Tel,Reason
 *   where Reason ∈ { "missing_payer_id", "no_match_in_json" }.
 *
 * Usage:
 *   ts-node merge-payer-addresses-fhir.ts <input.json> <input.csv> <output.json> [<unmatched.csv>]
 *
 * If <unmatched.csv> is not provided, it defaults to: <input.csv>.unmatched.csv
 */

import * as fs from 'fs';
import * as path from 'path';

type FhirCoding = {
  system?: string;
  code?: string;
};

type FhirIdentifier = {
  type?: {
    coding?: FhirCoding[];
  };
  value?: string;
};

type FhirAddress = {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[]; // FHIR R4: array of address lines
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: { start?: string; end?: string };
};

type FhirContactPoint = {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: { start?: string; end?: string };
};

type FhirOrganization = {
  resourceType: 'Organization';
  active?: boolean;
  name?: string;
  type?: Array<{ coding?: FhirCoding[] }>;
  identifier?: FhirIdentifier[];
  extension?: Array<{ url: string; valueString?: string }>;
  address?: FhirAddress[]; // FHIR-compliant: array
  telecom?: FhirContactPoint[]; // ContactPoint[]
};

type InputJson = {
  'schema-version': string;
  fhirResources: Record<string, FhirOrganization | any>;
};

type CsvRow = {
  payerIdNorm: string; // normalized (trimmed, uppercased); may be empty
  rawPayerId: string; // original (may be empty)
  name: string;
  line: string;
  city: string;
  state: string;
  postalCode: string;
  tel: string;
};

/** Minimal CSV parser (supports quotes, commas, CRLF/LF). */
function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  const n = content.length;

  function readCell(): string {
    let cell = '';
    if (content[i] === '"') {
      i++; // opening quote
      while (i < n) {
        const ch = content[i];
        if (ch === '"') {
          if (i + 1 < n && content[i + 1] === '"') {
            cell += '"';
            i += 2; // escaped quote
          } else {
            i++; // closing quote
            if (i < n && content[i] === ',') i++; // trailing comma
            break;
          }
        } else {
          cell += ch;
          i++;
        }
      }
    } else {
      while (i < n && content[i] !== ',' && content[i] !== '\n' && content[i] !== '\r') {
        cell += content[i++];
      }
      if (i < n && content[i] === ',') i++;
    }
    return cell;
  }

  function consumeNewline(): void {
    if (i < n && content[i] === '\r') i++;
    if (i < n && content[i] === '\n') i++;
  }

  while (i < n) {
    if (content[i] === '\r' || content[i] === '\n') {
      consumeNewline();
      continue;
    }
    const row: string[] = [];
    while (i < n) {
      const cell = readCell();
      row.push(cell);
      if (i >= n || content[i] === '\n' || content[i] === '\r') break;
    }
    if (i < n && (content[i] === '\n' || content[i] === '\r')) consumeNewline();
    if (!(row.length === 1 && row[0].trim() === '')) rows.push(row);
  }
  return rows;
}

function normalizePayerId(s: string | undefined | null): string {
  return (s ?? '').trim().toUpperCase();
}

type CsvHeaderIdx = {
  payerId: number;
  name: number;
  line: number;
  city: number;
  state: number;
  zip: number;
  tel: number;
};

function findHeaderIdx(header: string[]): CsvHeaderIdx {
  const idx = {
    payerId: header.findIndex((h) => /^payer\s*id$/i.test(h)),
    name: header.findIndex((h) => /^name$/i.test(h)),
    line: header.findIndex((h) => /^(address\s*line\s*1|address|address1)$/i.test(h)),
    city: header.findIndex((h) => /^city$/i.test(h)),
    state: header.findIndex((h) => /^state$/i.test(h)),
    zip: header.findIndex((h) => /^(zip|zipcode|postal\s*code)$/i.test(h)),
    tel: header.findIndex((h) => /^(tel|phone|telephone)$/i.test(h)),
  };
  // Require at least Payer Id, Address Line 1, City, State, Zip to exist as columns.
  const mustHave = ['payerId', 'line', 'city', 'state', 'zip'] as const;
  for (const key of mustHave) {
    if (idx[key] === -1) {
      throw new Error(`CSV header missing required column for ${key.toUpperCase()}.`);
    }
  }
  return idx as CsvHeaderIdx;
}

/** Read all CSV rows (including those without payer id) as CsvRow objects. */
function readAllCsvRows(csvPath: string): { header: string[]; rows: CsvRow[] } {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(raw);
  if (rows.length === 0) throw new Error('CSV appears empty.');

  const header = rows[0].map((h) => h.trim());
  const idx = findHeaderIdx(header);

  const out: CsvRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    while (row.length < header.length) row.push('');

    const rawPayerId = row[idx.payerId] ?? '';
    const payerIdNorm = normalizePayerId(rawPayerId);

    const rec: CsvRow = {
      payerIdNorm,
      rawPayerId: rawPayerId ?? '',
      name: idx.name !== -1 ? (row[idx.name] ?? '').trim() : '',
      line: idx.line !== -1 ? (row[idx.line] ?? '').trim() : '',
      city: idx.city !== -1 ? (row[idx.city] ?? '').trim() : '',
      state: idx.state !== -1 ? (row[idx.state] ?? '').trim() : '',
      postalCode: idx.zip !== -1 ? (row[idx.zip] ?? '').trim() : '',
      tel: idx.tel !== -1 ? (row[idx.tel] ?? '').trim() : '',
    };

    out.push(rec);
  }

  return { header, rows: out };
}

/** Build a map for address/phone application (only rows with useful content). */
function buildAddressBook(rows: CsvRow[]): Map<string, CsvRow> {
  const map = new Map<string, CsvRow>();
  for (const rec of rows) {
    if (!rec.payerIdNorm) continue; // skip rows w/o payerId for the address book
    // We can still apply telecom even if address lines are empty, but if ALL fields empty, skip.
    const hasAnyAddrOrTel = Boolean(rec.line || rec.city || rec.state || rec.postalCode || rec.tel);
    if (!hasAnyAddrOrTel) continue;

    if (!map.has(rec.payerIdNorm)) {
      map.set(rec.payerIdNorm, rec);
    }
  }
  return map;
}

/** Prefer v2-0203 "XX" value; fallback to payer-id coding.code. */
function extractPayerIdFromIdentifiers(org: FhirOrganization): string | null {
  if (!org.identifier) return null;

  for (const id of org.identifier) {
    const codings = id.type?.coding ?? [];
    const hasXX = codings.some(
      (c) =>
        (c.system ?? '').trim().toUpperCase() === 'HTTP://TERMINOLOGY.HL7.ORG/CODESYSTEM/V2-0203' &&
        (c.code ?? '').trim().toUpperCase() === 'XX'
    );
    if (hasXX && id.value) {
      const code = normalizePayerId(id.value);
      if (code) return code;
    }
  }

  for (const id of org.identifier) {
    const codings = id.type?.coding ?? [];
    for (const c of codings) {
      if ((c.system ?? '').trim().toUpperCase() === 'PAYER-ID' && c.code) {
        const code = normalizePayerId(c.code);
        if (code) return code;
      }
    }
  }

  return null;
}

/** Fallback: get suffix of the resource key after "payer-organization-". */
function extractPayerIdFromKey(key: string): string | null {
  const prefix = 'payer-organization-';
  if (key.startsWith(prefix)) {
    const suffix = key.substring(prefix.length);
    const norm = normalizePayerId(suffix);
    return norm || null;
  }
  return null;
}

/** Convert a CSV row to a FHIR Address[] respecting the user's requested shape. */
function toFhirAddressArray(rec: CsvRow): FhirAddress[] {
  const line = (rec.line ?? '').trim();
  const lines = line ? [line] : [];

  const addr: FhirAddress = {
    use: 'billing',
    line: lines,
    city: rec.city || undefined,
    state: rec.state || undefined,
    postalCode: rec.postalCode || undefined,
  };

  return [addr];
}

/** Extract one or more phone numbers from a raw CSV "Tel" field. */
function extractPhonesFromCsvTel(tel: string | undefined): string[] {
  if (!tel) return [];

  // Split on common separators: comma, semicolon, slash, pipe, or repeated spaces
  const candidates = tel
    .split(/[,;/|]+|\s{2,}/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const phones: string[] = [];

  for (const c of candidates) {
    let v = c.replace(/^"+|"+$/g, '').trim();
    v = v.replace(/[^0-9+()\-.\s]/g, '').trim();
    v = v.replace(/\s{2,}/g, ' ').replace(/\.{2,}/g, '.');
    const digitCount = (v.match(/\d/g) || []).length;
    if (digitCount >= 7) phones.push(v);
  }

  const seen = new Set<string>();
  const unique = phones.filter((p) => {
    const key = p.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique;
}

/** Merge phone numbers into org.telecom, preserving existing entries and skipping duplicates. */
function mergePhonesIntoTelecom(org: FhirOrganization, phones: string[]): void {
  if (!phones.length) return;

  if (!org.telecom) org.telecom = [];

  const existingPhones = new Set(
    org.telecom
      .filter((t) => (t.system ?? '').toLowerCase() === 'phone' && (t.value ?? '').trim() !== '')
      .map((t) => (t.value as string).trim().toLowerCase())
  );

  for (const p of phones) {
    const key = p.trim().toLowerCase();
    if (!existingPhones.has(key)) {
      org.telecom.push({ system: 'phone', value: p });
      existingPhones.add(key);
    }
  }
}

/** Write a simple CSV (RFC4180-ish). Values are quoted if needed. */
function writeCsv(filePath: string, header: string[], rows: string[][]): void {
  const esc = (v: string): string => {
    if (/[",\r\n]/.test(v)) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [header.map(esc).join(',')].concat(rows.map((r) => r.map(esc).join(',')));
  fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8');
}

function mergeAddressesAndPhones(jsonPath: string, csvPath: string, outPath: string, unmatchedPath?: string): void {
  const jsonRaw = fs.readFileSync(jsonPath, 'utf8');
  const data: InputJson = JSON.parse(jsonRaw);

  if (!data || typeof data !== 'object' || !data.fhirResources || typeof data.fhirResources !== 'object') {
    throw new Error("Input JSON doesn't look like the expected structure with 'fhirResources'.");
  }

  const { rows: allCsvRows } = readAllCsvRows(csvPath);
  const addressBook = buildAddressBook(allCsvRows);

  // For unmatched reporting:
  // - collect all CSV rows grouped by normalized payerId (only those that HAVE a payerId)
  // - keep also a list of rows without payerId
  const csvRowsByPayerId = new Map<string, CsvRow>();
  const rowsMissingPayerId: CsvRow[] = [];
  for (const r of allCsvRows) {
    if (!r.payerIdNorm) {
      rowsMissingPayerId.push(r);
    } else if (!csvRowsByPayerId.has(r.payerIdNorm)) {
      csvRowsByPayerId.set(r.payerIdNorm, r);
    }
  }

  // Merge into JSON, and simultaneously record which CSV payerIds found a match in JSON
  let matchedAddrCount = 0;
  let totalOrgs = 0;
  let phoneAdds = 0;
  const matchedCsvPayerIds = new Set<string>();

  for (const [key, resource] of Object.entries(data.fhirResources)) {
    if (!resource || resource.resourceType !== 'Organization') continue;
    totalOrgs++;

    const org = resource as FhirOrganization;

    let payerId = extractPayerIdFromIdentifiers(org);
    if (!payerId) payerId = extractPayerIdFromKey(key);
    if (!payerId) continue;

    // mark as matched (for unmatched-reporting), regardless of whether we can apply an address
    if (csvRowsByPayerId.has(payerId)) {
      matchedCsvPayerIds.add(payerId);
    }

    // Apply address/phones only when we have a usable record
    const rec = addressBook.get(payerId);
    if (!rec) continue;

    // Overwrite with FHIR-compliant address
    org.address = toFhirAddressArray(rec);
    matchedAddrCount++;

    // Merge phone(s) into telecom (preserve existing entries)
    const phones = extractPhonesFromCsvTel(rec.tel);
    const before = org.telecom?.length ?? 0;
    mergePhonesIntoTelecom(org, phones);
    const after = org.telecom?.length ?? 0;
    phoneAdds += Math.max(0, after - before);
  }

  // Write merged JSON
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');

  // Build unmatched CSV
  const unmatchedRows: string[][] = [];

  // 1) Rows with missing payer id
  for (const r of rowsMissingPayerId) {
    unmatchedRows.push([
      '', // Payer Id
      r.name ?? '',
      r.line ?? '',
      r.city ?? '',
      r.state ?? '',
      r.postalCode ?? '',
      r.tel ?? '',
      'missing_payer_id',
    ]);
  }

  // 2) Rows with payer id that didn't match any JSON org
  for (const [pid, r] of csvRowsByPayerId.entries()) {
    if (!matchedCsvPayerIds.has(pid)) {
      unmatchedRows.push([
        r.rawPayerId ?? '',
        r.name ?? '',
        r.line ?? '',
        r.city ?? '',
        r.state ?? '',
        r.postalCode ?? '',
        r.tel ?? '',
        'no_match_in_json',
      ]);
    }
  }

  const unmatchedHeader = ['Payer Id', 'Name', 'Address Line 1', 'City', 'State', 'Zip', 'Tel', 'Reason'];
  const outUnmatched = unmatchedPath && unmatchedPath.trim().length > 0 ? unmatchedPath : `${csvPath}.unmatched.csv`;
  writeCsv(outUnmatched, unmatchedHeader, unmatchedRows);

  // Report
  console.log(`Organizations scanned:     ${totalOrgs}`);
  console.log(`Addresses applied:         ${matchedAddrCount}`);
  console.log(`Telecom phones added:      ${phoneAdds}`);
  console.log(`Output JSON:               ${path.resolve(outPath)}`);
  console.log(`Unmatched CSV rows:        ${unmatchedRows.length}`);
  console.log(`Unmatched CSV written to:  ${path.resolve(outUnmatched)}`);
}

/** CLI */
(function cli() {
  const [jsonPath, csvPath, outPath, unmatchedPath] = process.argv.slice(2);
  if (!jsonPath || !csvPath || !outPath) {
    console.error(
      'Usage: ts-node merge-payer-addresses-fhir.ts <input.json> <input.csv> <output.json> [<unmatched.csv>]'
    );
    process.exit(1);
  }
  mergeAddressesAndPhones(jsonPath, csvPath, outPath, unmatchedPath);
})();
