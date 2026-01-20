import crypto from 'crypto';

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CHARSET_LENGTH = CHARSET.length;
const MAX_BYTE = 256;
const REJECTION_LIMIT = Math.floor(MAX_BYTE / CHARSET_LENGTH) * CHARSET_LENGTH;

export const generateId = (): string => {
  let id = '';
  while (id.length < 8) {
    const bytes = crypto.randomBytes(8);
    for (const byte of bytes) {
      if (byte >= REJECTION_LIMIT) {
        continue;
      }
      id += CHARSET[byte % CHARSET_LENGTH];
      if (id.length === 8) {
        break;
      }
    }
  }
  return id;
};
