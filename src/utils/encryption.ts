import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

/**
 * Encrypt sensitive data before storing in database
 */
export function encrypt(data: string): string {
  if (!data) return data;
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
}

/**
 * Decrypt sensitive data from database
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return encryptedData;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedData;
  }
}

/**
 * Generate random ID for tenants and other entities
 */
export function generateId(prefix: string = ''): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}_${randomPart}` : randomPart;
}

/**
 * Create slug from string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}
