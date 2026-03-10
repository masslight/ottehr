import { getSecret, Secrets, SecretsKeys } from 'utils';

// PostGrid Print & Mail API
// Docs: https://docs.postgrid.com

const POSTGRID_BASE_URL = 'https://print.postgrid.com/print-mail/v1';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PostGridAddress {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  provinceOrState: string;
  postalOrZip: string;
  countryCode: string;
}

export type PostGridLetterStatus = 'ready' | 'printing' | 'processed_for_delivery' | 'completed' | 'cancelled';

export interface PostGridLetter {
  id: string;
  object: string;
  live: boolean;
  description?: string;
  to: PostGridAddress & { id?: string };
  from: PostGridAddress & { id?: string };
  template?: string;
  html?: string;
  url?: string;
  mergeVariables?: Record<string, unknown>;
  status: PostGridLetterStatus;
  sendDate?: string;
  mailingClass?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PostGridError {
  error: {
    type: string;
    message: string;
  };
}

export interface SendLetterInput {
  to: PostGridAddress | string;
  from: PostGridAddress | string;
  template?: string;
  html?: string;
  mergeVariables?: Record<string, unknown>;
  description?: string;
  mailingClass?: string;
  sendDate?: string;
  color?: boolean;
  doubleSided?: boolean;
  addressPlacement?: 'insert_blank_page' | 'top_first_page';
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

function getApiKey(secrets: Secrets | null): string {
  return getSecret(SecretsKeys.POSTGRID_API_KEY, secrets);
}

async function postgridRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  secrets: Secrets | null,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): Promise<T> {
  const url = `${POSTGRID_BASE_URL}${path}`;
  const apiKey = getApiKey(secrets);

  const requestHeaders: Record<string, string> = {
    'x-api-key': apiKey,
    'Content-Type': 'application/json',
    ...headers,
  };

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json();

  if (!response.ok) {
    const pgError = json as PostGridError;
    throw new Error(
      `PostGrid API error (${response.status}): ${pgError.error?.type ?? 'unknown'} — ${
        pgError.error?.message ?? response.statusText
      }`
    );
  }

  return json as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create and send a letter via PostGrid.
 * POST /letters
 *
 * You can supply either a `template` ID or raw `html` for the letter content.
 * `mergeVariables` will be interpolated into the template/html by PostGrid.
 */
export async function sendPostGridLetter(input: SendLetterInput, secrets: Secrets | null): Promise<PostGridLetter> {
  const { idempotencyKey, ...bodyFields } = input;

  const extraHeaders: Record<string, string> = {};
  if (idempotencyKey) {
    extraHeaders['Idempotency-Key'] = idempotencyKey;
  }

  return postgridRequest<PostGridLetter>(
    'POST',
    '/letters',
    secrets,
    bodyFields as Record<string, unknown>,
    extraHeaders
  );
}
