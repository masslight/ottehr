import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';

const CLAIMMD_API_BASE = 'https://svc.claim.md/services';

interface EnvConfig {
  CLAIMMD_ACCOUNT_KEY: string;
}

function loadEnvConfig(env: string): EnvConfig {
  const configPath = `../../config/.env/${env}.json`;

  if (!fs.existsSync(configPath)) {
    console.error(`❌ Config file not found: ${configPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  if (!raw.CLAIMMD_ACCOUNT_KEY) {
    console.error(`❌ Missing CLAIMMD_ACCOUNT_KEY in ${configPath}`);
    process.exit(1);
  }

  return raw as EnvConfig;
}

interface EraListItem {
  eraid: string;
  check_number: string;
  check_type: string;
  paid_amount: string;
  paid_date: string;
  payer_name: string;
  payerid: string;
  prov_name: string;
  prov_npi: string;
  received_time: string;
}

async function postForm(endpoint: string, params: Record<string, string>, accept = 'application/json'): Promise<any> {
  const url = `${CLAIMMD_API_BASE}/${endpoint}/`;
  const body = new URLSearchParams(params).toString();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: accept,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Claim.md ${endpoint} returned ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function fetchAllEras(accountKey: string): Promise<EraListItem[]> {
  const allEras: EraListItem[] = [];
  let page = 1;
  let hasMore = true;

  // Fetch all ERAs (set NewOnly=0 to get all, not just new)
  while (hasMore) {
    console.log(`  Fetching ERA list page ${page}...`);
    const result = await postForm('eralist', {
      AccountKey: accountKey,
      NewOnly: '0',
      Page: String(page),
    });

    const eras: EraListItem[] = result?.era ?? result?.result?.era ?? [];

    if (!Array.isArray(eras) || eras.length === 0) {
      // Try to handle the response if it's structured differently
      if (result?.result && Array.isArray(result.result)) {
        allEras.push(...result.result);
      }
      hasMore = false;
    } else {
      allEras.push(...eras);

      // Claim.md returns up to 100 results per page
      if (eras.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  return allEras;
}

async function downloadEra835(accountKey: string, eraid: string): Promise<string | null> {
  try {
    const result = await postForm('era835', {
      AccountKey: accountKey,
      eraid,
    });

    // The 835/X12 data can be a string or an array of strings
    const data = result?.data ?? result?.result?.data ?? result?.era?.data;
    if (typeof data === 'string') {
      return data;
    }
    if (Array.isArray(data)) {
      return data.join('');
    }
    // Log the full response (truncated) so we can see the actual structure
    const preview = JSON.stringify(result).slice(0, 500);
    console.warn(`  ⚠️  835 for ERA ${eraid}: no 'data' field found. Response preview: ${preview}`);
    return null;
  } catch (err) {
    console.warn(`  ⚠️  Failed to download 835 for ERA ${eraid}:`, err);
    return null;
  }
}

async function downloadEraPdf(accountKey: string, eraid: string): Promise<Uint8Array | null> {
  try {
    const result = await postForm('erapdf', {
      AccountKey: accountKey,
      eraid,
    });

    const base64Data = result?.data ?? result?.result?.data;
    if (typeof base64Data === 'string') {
      return new Uint8Array(Buffer.from(base64Data, 'base64'));
    }
    if (Array.isArray(base64Data)) {
      return new Uint8Array(Buffer.from(base64Data.join(''), 'base64'));
    }
    console.warn(
      `  ⚠️  PDF for ERA ${eraid}: no string 'data' field found. Keys: ${JSON.stringify(Object.keys(result ?? {}))}`
    );
    return null;
  } catch (err) {
    console.warn(`  ⚠️  Failed to download PDF for ERA ${eraid}:`, err);
    return null;
  }
}

async function downloadEraData(accountKey: string, eraid: string): Promise<any | null> {
  try {
    const result = await postForm('eradata', {
      AccountKey: accountKey,
      eraid,
    });
    return result;
  } catch (err) {
    console.warn(`  ⚠️  Failed to download ERA data (JSON) for ERA ${eraid}:`, err);
    return null;
  }
}

const ERA_DETAIL_CSV_COLUMNS = [
  'ERA ID',
  'Check Number',
  'Payer Name',
  'Patient Last',
  'Patient First',
  'Insured Last',
  'Insured First',
  'Insured Number',
  'Payer ICN',
  'Account Number',
  'Provider NPI',
  'Status Code',
  'From DOS',
  'Thru DOS',
  'Total Charge',
  'Total Paid',
  'Proc Code',
  'Mod1',
  'Mod2',
  'Units',
  'Line Charge',
  'Line Allowed',
  'Line Paid',
  'Adjustment Group',
  'Adjustment Code',
  'Adjustment Amount',
];

function buildEraDetailCsv(eraData: any): string | null {
  const claims = eraData?.claim ?? eraData?.result?.claim ?? [];
  if (!Array.isArray(claims) || claims.length === 0) return null;

  const checkNumber = String(eraData?.check_number ?? eraData?.result?.check_number ?? '');
  const payerName = String(eraData?.payer_name ?? eraData?.result?.payer_name ?? '');
  const eraid = String(eraData?.eraid ?? eraData?.result?.eraid ?? '');

  const rows: string[] = [];
  for (const claim of claims) {
    const charges = Array.isArray(claim.charge) ? claim.charge : claim.charge ? [claim.charge] : [];
    for (const charge of charges) {
      const adjustments = Array.isArray(charge.adjustment)
        ? charge.adjustment
        : charge.adjustment
        ? [charge.adjustment]
        : [{}];
      for (const adj of adjustments) {
        rows.push(
          [
            eraid,
            checkNumber,
            payerName,
            claim.pat_name_l,
            claim.pat_name_f,
            claim.ins_name_l,
            claim.ins_name_f,
            claim.ins_number,
            claim.payer_icn,
            claim.pcn,
            claim.prov_npi,
            claim.status_code,
            claim.from_dos,
            claim.thru_dos,
            claim.total_charge,
            claim.total_paid,
            charge.proc_code,
            charge.mod1,
            charge.mod2,
            charge.units,
            charge.charge,
            charge.allowed,
            charge.paid,
            adj.group,
            adj.code,
            adj.amount,
          ]
            .map(escapeCsvField)
            .join(',')
        );
      }
    }
  }

  const header = ERA_DETAIL_CSV_COLUMNS.map(escapeCsvField).join(',');
  return [header, ...rows].join('\n');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function buildEraCsvRow(era: EraListItem): string[] {
  return [
    era.eraid,
    era.check_number,
    era.check_type,
    era.paid_amount,
    era.paid_date,
    era.payer_name,
    era.payerid,
    era.prov_name,
    era.prov_npi,
    era.received_time,
  ];
}

function escapeCsvField(field: string): string {
  const str = String(field ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const ERA_CSV_COLUMNS = [
  'ERA ID',
  'Check Number',
  'Check Type',
  'Paid Amount',
  'Paid Date',
  'Payer Name',
  'Payer ID',
  'Provider Name',
  'Provider NPI',
  'Received Time',
];

function buildEraSummaryCsv(eras: EraListItem[]): string {
  const header = ERA_CSV_COLUMNS.map(escapeCsvField).join(',');
  const rows = eras.map((era) => buildEraCsvRow(era).map(escapeCsvField).join(','));
  return [header, ...rows].join('\n');
}

function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main(): Promise<void> {
  const env = process.argv[2];
  const dirName = process.argv[3];

  if (!env || !dirName) {
    console.log('Usage: npm run download-eras <env> <directory-name>');
    console.log('  <env>             Environment name (e.g. local, staging, production)');
    console.log('  <directory-name>  Name of the output folder (created inside ~/Downloads/)');
    process.exit(0);
  }

  console.log(`📥 Starting ERA download for environment: ${env}`);

  const config = loadEnvConfig(env);

  // Create output directory
  const outputDir = path.join(os.homedir(), 'Downloads', dirName);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`Output directory: ${outputDir}`);

  // Step 1: Fetch all ERA listings
  console.log('\nFetching ERA list...');
  const eras = await fetchAllEras(config.CLAIMMD_ACCOUNT_KEY);
  console.log(`Found ${eras.length} ERAs.`);

  if (eras.length === 0) {
    console.log('No ERAs found. Nothing to download.');
    return;
  }

  // Show date range and prompt for count
  const dates = eras.map((e) => e.paid_date).filter(Boolean);
  const oldest = dates[dates.length - 1] ?? 'unknown';
  const newest = dates[0] ?? 'unknown';
  console.log(`\n  Date range: ${oldest} (oldest) → ${newest} (newest)`);

  const prompt = `\nHow many ERAs to download? (1-${eras.length}, blank = all): `;
  let maxDownload: number | undefined;
  while (maxDownload === undefined) {
    const input = await promptUser(prompt);
    const lower = input.toLowerCase();
    if (lower === 'q' || lower === 'e' || lower === 'x') {
      console.log('Exiting.');
      return;
    }
    if (input === '') {
      console.log(`⚠️  No limit specified — downloading ALL ${eras.length} ERAs.`);
      maxDownload = eras.length;
    } else {
      const parsed = parseInt(input, 10);
      if (isNaN(parsed) || parsed < 1) {
        console.error(`❌ "${input}" is not a valid number. Please enter a number between 1 and ${eras.length}.`);
      } else {
        maxDownload = Math.min(parsed, eras.length);
      }
    }
  }

  const erasToDownload = eras.slice(0, maxDownload);
  console.log(`\nDownloading ${erasToDownload.length} most recent ERAs (of ${eras.length} total).`);

  // Step 2: Write summary CSV
  const summaryCsv = buildEraSummaryCsv(eras);
  const summaryCsvPath = path.join(outputDir, 'era-summary.csv');
  fs.writeFileSync(summaryCsvPath, summaryCsv, 'utf8');
  console.log(`📄 ERA summary CSV written to ${summaryCsvPath}`);

  // Step 3: Download each ERA in all formats
  let downloaded835 = 0;
  let downloadedPdf = 0;
  let downloadedJson = 0;
  let downloadedCsv = 0;

  for (let i = 0; i < erasToDownload.length; i++) {
    const era = erasToDownload[i];
    const label = `${era.eraid}_${era.paid_date}`;

    // Build folder hierarchy: provider (NPI_Name) / payer (PayerID_Name) / format
    const provFolder = sanitizeFilename(`${era.prov_npi}_${era.prov_name}`);
    const payerFolder = sanitizeFilename(`${era.payerid}_${era.payer_name}`);
    const eraBaseDir = path.join(outputDir, provFolder, payerFolder);
    fs.mkdirSync(path.join(eraBaseDir, '835'), { recursive: true });
    fs.mkdirSync(path.join(eraBaseDir, 'pdf'), { recursive: true });
    fs.mkdirSync(path.join(eraBaseDir, 'json'), { recursive: true });
    fs.mkdirSync(path.join(eraBaseDir, 'csv'), { recursive: true });

    console.log(
      `\n[${i + 1}/${erasToDownload.length}] ERA ${era.eraid} — ${era.payer_name} — $${era.paid_amount} — ${
        era.paid_date
      }`
    );

    // Download 835 (X12 format)
    const data835 = await downloadEra835(config.CLAIMMD_ACCOUNT_KEY, era.eraid);
    if (data835) {
      fs.writeFileSync(path.join(eraBaseDir, '835', `${label}.835.x12.txt`), data835, 'utf8');
      downloaded835++;
    }

    // Download PDF
    const pdfData = await downloadEraPdf(config.CLAIMMD_ACCOUNT_KEY, era.eraid);
    if (pdfData) {
      fs.writeFileSync(path.join(eraBaseDir, 'pdf', `${label}.pdf`), pdfData);
      downloadedPdf++;
    }

    // Download JSON (structured data)
    const jsonData = await downloadEraData(config.CLAIMMD_ACCOUNT_KEY, era.eraid);
    if (jsonData) {
      fs.writeFileSync(path.join(eraBaseDir, 'json', `${label}.json`), JSON.stringify(jsonData, null, 2), 'utf8');
      downloadedJson++;

      // Generate per-ERA CSV from JSON data
      const csvData = buildEraDetailCsv(jsonData);
      if (csvData) {
        fs.writeFileSync(path.join(eraBaseDir, 'csv', `${label}.csv`), csvData, 'utf8');
        downloadedCsv++;
      }
    }

    // Respect Claim.md rate limit (100 requests/min). Each ERA makes 3 calls.
    // Wait 2 seconds between ERAs to stay well under the limit.
    if (i < erasToDownload.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n📊 Download Summary:`);
  console.log(`   835/X12 files: ${downloaded835}/${erasToDownload.length}`);
  console.log(`   PDF files:     ${downloadedPdf}/${erasToDownload.length}`);
  console.log(`   JSON files:    ${downloadedJson}/${erasToDownload.length}`);
  console.log(`   CSV files:     ${downloadedCsv}/${erasToDownload.length}`);
  console.log(`   Summary CSV:   ${summaryCsvPath}`);
  console.log(`   Output dir:    ${outputDir}`);
}

main()
  .then(() => console.log('\n✅ Done.'))
  .catch((error) => {
    console.error(error);
    throw error;
  });
