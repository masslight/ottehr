#!/usr/bin/env npm exec -- tsx

// Playwright traces record request headers, the browser storage state and filled values, so the bearer tokens
// and credentials a test used end up in them. This strips those before the results are uploaded as public
// artifacts, keeping everything needed to see why a test failed. A file that cannot be cleaned is deleted.

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import * as fs from 'fs';
import * as path from 'path';
import { readSecretValues } from './secret-values';

const REDACTED = '[REDACTED]';
const SENSITIVE_HEADER = /^(authorization|cookie|set-cookie|x-api-key|x-goog-api-key)$/i;
const JWT = /ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g;
const TOKEN_FIELD =
  /(\\*["']?(?:access_token|id_token|refresh_token|client_secret|code_verifier|password)\\*["']?\s*[:=]\s*\\*["']?)[^"'\\&\s,}]+/gi;
const UNTOUCHED_FILE = /\.(jpe?g|png|gif|webp|webm|mp4|woff2?|ttf|otf|ico|svg|js|mjs|css|map|webmanifest)$/i;
const JSON_LINES_FILE = /\.(trace|network)$/;
const EMBEDDED_REPORT = /(data:application\/zip;base64,)([A-Za-z0-9+/=]+)/;

type Json = Record<string, any>;

const secretValues = readSecretValues().values;

function redactText(text: string): string {
  let result = text.replace(JWT, REDACTED).replace(TOKEN_FIELD, `$1${REDACTED}`);
  for (const value of secretValues) {
    result = result.split(value).join(REDACTED);
  }
  return result;
}

function redactHeaders(headers: unknown): void {
  if (!Array.isArray(headers)) return;
  for (const header of headers) {
    if (header && SENSITIVE_HEADER.test(String(header.name))) header.value = REDACTED;
  }
}

function redactTraceEvent(event: Json): void {
  if (event.type === 'context-options' && event.options) {
    delete event.options.storageState;
  }
  if (event.type === 'resource-snapshot') {
    redactHeaders(event.snapshot?.request?.headers);
    redactHeaders(event.snapshot?.response?.headers);
    for (const cookie of [...(event.snapshot?.request?.cookies ?? []), ...(event.snapshot?.response?.cookies ?? [])]) {
      cookie.value = REDACTED;
    }
  }
  if (typeof event.params?.value === 'string' && /password|#code\b/i.test(String(event.params?.selector ?? ''))) {
    event.params.value = REDACTED;
  }
}

function redactJsonLines(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      if (!line.trim()) return line;
      const event = JSON.parse(line) as Json;
      redactTraceEvent(event);
      return JSON.stringify(event);
    })
    .join('\n');
}

function redactEntry(name: string, data: Uint8Array): Uint8Array {
  if (UNTOUCHED_FILE.test(name)) return data;
  if (name.endsWith('.zip')) return redactZip(data);
  if (JSON_LINES_FILE.test(name)) return strToU8(redactText(redactJsonLines(strFromU8(data))));
  return strToU8(redactText(strFromU8(data, true)), true);
}

function redactZip(data: Uint8Array): Uint8Array {
  const entries = unzipSync(data);
  for (const name of Object.keys(entries)) {
    entries[name] = redactEntry(name, entries[name]);
  }
  return zipSync(entries);
}

function redactFile(file: string): void {
  const data = new Uint8Array(fs.readFileSync(file));
  if (path.basename(file) === 'index.html') {
    const html = strFromU8(data, true).replace(EMBEDDED_REPORT, (_match, prefix: string, base64: string) => {
      const report = redactZip(new Uint8Array(Buffer.from(base64, 'base64')));
      return prefix + Buffer.from(report).toString('base64');
    });
    fs.writeFileSync(file, strToU8(html, true));
    return;
  }
  fs.writeFileSync(file, redactEntry(file, data));
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

let failed = 0;
const files = process.argv.slice(2).flatMap(walk);
for (const file of files) {
  try {
    redactFile(file);
  } catch (error) {
    failed++;
    fs.rmSync(file, { force: true });
    console.error(`Deleted ${file}: could not sanitize it (${error instanceof Error ? error.message : error})`);
  }
}
console.log(`Sanitized ${files.length - failed} files, deleted ${failed}`);
