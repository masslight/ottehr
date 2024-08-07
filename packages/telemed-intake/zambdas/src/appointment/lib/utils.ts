import { Secrets } from 'ottehr-utils';
import { getM2MClientToken } from '../../shared';
import { DateTime } from 'luxon';
import axios from 'axios';
import { Page, expect, firefox, webkit } from '@playwright/test';

export async function checkOrCreateToken(token: string, secrets: Secrets | null): Promise<string> {
  if (!token) {
    console.log('getting token');
    return await getM2MClientToken(secrets);
  } else {
    console.log('already have token');
    return token;
  }
}
