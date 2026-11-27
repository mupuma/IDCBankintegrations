import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { getSequelize } from './db';
import { LoginOtpChallenge } from '../models/internal/LoginOtp';
import { User } from '../models/internal/User';
import { sendLoginEmail, type SmtpConfiguration } from './loginSmtp';

const CODE_LIFETIME_MS = 5 * 60 * 1000;
const RESEND_INTERVAL_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function digest(user: User, challengeId: string, code: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  return createHmac('sha256', secret)
    .update(JSON.stringify(['login-otp', user.id, user.email, user.password, challengeId, code]))
    .digest('hex');
}

export async function issueLoginOtp(user: User, config: SmtpConfiguration) {
  const challengeId = randomUUID();
  const code = String(randomInt(1000000)).padStart(6, '0');
  const db = await getSequelize();
  const issued = await db.transaction(async transaction => {
    const current = await User.findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!current?.isActive || current.email !== user.email || current.password !== user.password) return false;
    const previous = await LoginOtpChallenge.findByPk(user.id, { transaction });
    if (previous && Date.now() - previous.issuedAt.getTime() < RESEND_INTERVAL_MS) return false;
    await LoginOtpChallenge.upsert({
      userId: user.id, challengeId, digest: digest(current, challengeId, code), issuedAt: new Date(), attempts: 0,
    }, { transaction });
    return true;
  });
  if (!issued) return null;

  try {
    await sendLoginEmail(config, user.email!, 'Infratel portal sign-in code',
      'Your sign-in code is ' + code + '. It expires in five minutes.');
  } catch (error) {
    await LoginOtpChallenge.update({ attempts: MAX_ATTEMPTS }, { where: { userId: user.id, challengeId } });
    throw error;
  }
  return challengeId;
}

export async function verifyLoginOtp(username: string, challengeId: string, code: string) {
  const db = await getSequelize();
  return db.transaction(async transaction => {
    const user = await User.findOne({ where: { username }, transaction, lock: transaction.LOCK.UPDATE });
    if (!user?.isActive || !user.email) return null;
    const challenge = await LoginOtpChallenge.findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!challenge || challenge.challengeId !== challengeId || challenge.attempts >= MAX_ATTEMPTS
      || Date.now() - challenge.issuedAt.getTime() >= CODE_LIFETIME_MS) return null;

    const valid = timingSafeEqual(Buffer.from(challenge.digest, 'hex'), Buffer.from(digest(user, challengeId, code), 'hex'));
    await challenge.update({ attempts: valid ? MAX_ATTEMPTS : challenge.attempts + 1 }, { transaction });
    return valid ? user : null;
  });
}
