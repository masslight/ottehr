import fs from 'fs';
import path from 'path';

/**
 * Reads the logo.png from the assets directory and returns a base64 data URL string.
 */
export function getLogoBase64(): string {
  const logoPath = path.resolve(process.cwd(), 'assets', 'logo.png');
  const logoBuffer = fs.readFileSync(logoPath);
  return `data:image/png;base64,${logoBuffer.toString('base64')}`;
}
