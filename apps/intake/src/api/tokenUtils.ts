import { decodeJwt } from 'jose';

export const checkTokenIsValid = (token: string): boolean => {
  try {
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp - 30 > now;
  } catch {
    return false;
  }
};
