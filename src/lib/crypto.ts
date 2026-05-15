import CryptoJS from 'crypto-js';

const getEncryptionKey = (): string => {
  return process.env.ENCRYPTION_KEY || 'default-encryption-key-12345';
};

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  return CryptoJS.AES.encrypt(text, key).toString();
}

export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const bytes = CryptoJS.AES.decrypt(ciphertext, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}
