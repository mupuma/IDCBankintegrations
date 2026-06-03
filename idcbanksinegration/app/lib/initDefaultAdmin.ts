import { connectDatabase } from './db';
import { User } from '../models/internal/User';
import * as bcrypt from 'bcrypt';

const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME ?? 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD ?? 'Admin123';
const DEFAULT_ADMIN_ROLE = process.env.DEFAULT_ADMIN_ROLE ?? 'ADMIN';

function isBcryptHash(value: string | undefined): boolean {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

let adminInitPromise: Promise<void> | null = null;

export async function ensureDefaultAdmin(): Promise<void> {
  if (adminInitPromise) {
    return adminInitPromise;
  }

  adminInitPromise = (async () => {
    try {
      await connectDatabase();
      const user = await User.findOne({ where: { username: DEFAULT_ADMIN_USERNAME } });

      if (!user) {
        await User.create({
          username: DEFAULT_ADMIN_USERNAME,
          password: DEFAULT_ADMIN_PASSWORD,
          role: DEFAULT_ADMIN_ROLE,
        });
        console.log(`Default admin user created: ${DEFAULT_ADMIN_USERNAME}`);
        return;
      }

      const passwordMatchesDefault = user.password && isBcryptHash(user.password)
        ? await bcrypt.compare(DEFAULT_ADMIN_PASSWORD, user.password)
        : false;

      if (!passwordMatchesDefault) {
        const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
        user.password = hashedPassword;
        await user.save({ hooks: false });
        console.log(`Default admin password reset to configured default for user: ${DEFAULT_ADMIN_USERNAME}`);
      }

      if (user.role !== DEFAULT_ADMIN_ROLE) {
        await user.update({ role: DEFAULT_ADMIN_ROLE });
        console.log(`Default admin role updated to ${DEFAULT_ADMIN_ROLE}`);
      }
    } catch (error) {
      console.error('Unable to create default admin user:', error);
    }
  })();

  return adminInitPromise;
}

// Trigger creation during module initialization when this file is imported.
void ensureDefaultAdmin();
