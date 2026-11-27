import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';

export interface SmtpConfiguration {
  host: string;
  port: number;
  mode: 'tls' | 'starttls';
  username: string;
  password: string;
  sender: string;
}

export function normalizeEmail(value: unknown) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return email.length <= 254 && /^[^\s@<>(),:;"]+@[^\s@<>(),:;"]+\.[^\s@<>(),:;"]+$/.test(email) ? email : null;
}

export function hasSmtpEncryptionKey() {
  return /^[0-9a-f]{64}$/i.test(process.env.SMTP_ENCRYPTION_KEY ?? '');
}

function encryptionKey() {
  if (!hasSmtpEncryptionKey()) throw new Error('SMTP_ENCRYPTION_KEY must contain 32 bytes encoded as hex');
  return Buffer.from(process.env.SMTP_ENCRYPTION_KEY!, 'hex');
}

export function encryptSmtpPassword(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

export async function sendLoginEmail(config: SmtpConfiguration, to: string, subject: string, body: string) {
  const bytes = Buffer.from(config.password, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  const password = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.mode === 'tls',
    requireTLS: config.mode === 'starttls',
    auth: config.username ? { user: config.username, pass: password } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  await transport.sendMail({ from: config.sender, to, subject, text: body });
}
