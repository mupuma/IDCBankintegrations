'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PERMISSIONS, ROLE_LABELS, normalizeRole, type Permission } from '@/app/lib/permissions';
import { usePortalUser } from '@/app/lib/usePortalUser';

type NavItem = {
  name: string;
  href: string;
  permission: Permission;
  icon: React.ReactNode;
};

const coreNavItems: NavItem[] = [
  {
    name: 'Vendor Bank Details',
    href: '/bank_details',
    permission: PERMISSIONS.BANK_DETAILS_READ,
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    name: 'Posted Payments',
    href: '/bank_details/payments',
    permission: PERMISSIONS.PAYMENTS_READ,
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    name: 'Payment Queues',
    href: '/bank_details/payment_queues',
    permission: PERMISSIONS.QUEUES_READ,
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18M6 4v16M18 4v16" />
      </svg>
    ),
  },
];

const adminNavItems: NavItem[] = [
  {
    name: 'Audit Logs',
    href: '/bank_details/audit_logs',
    permission: PERMISSIONS.AUDIT_READ,
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    name: 'User Management',
    href: '/bank_details/users',
    permission: PERMISSIONS.USERS_MANAGE,
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
];

function NavLink({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const isActive = pathname === item.href;

  return (
    <Link
      href={item.href}
      className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
        isActive
          ? 'bg-blue-50 text-blue-700'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      {isActive ? (
        <div className="absolute left-0 h-6 w-1 rounded-r-full bg-blue-600" />
      ) : null}
      <span
        className={`transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}
      >
        {item.icon}
      </span>
      {item.name}
    </Link>
  );
}

export default function BankDetailsSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hasPermission } = usePortalUser();

  const visibleCore = coreNavItems.filter((item) => hasPermission(item.permission));
  const visibleAdmin = adminNavItems.filter((item) => hasPermission(item.permission));

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '—';

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) router.push('/login');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-50 p-6">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-sm font-bold leading-tight text-slate-900">
              <img src="/idc_logo.png" alt="IDC Logo" className="h-10 w-auto object-contain" />
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Payments Portal
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
        <p className="mb-4 px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Core Operations
        </p>
        {visibleCore.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {visibleAdmin.length > 0 ? (
          <>
            <p className="mb-4 mt-8 px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Administration
            </p>
            {visibleAdmin.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </>
        ) : null}
      </nav>

      <div className="border-t border-slate-100 bg-slate-50/50 p-4">
        <div className="mb-4 flex items-center gap-3 px-2">
          <div className="h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-slate-200 shadow-sm">
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-400 to-slate-500 text-[10px] font-bold text-white">
              {initials}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-900">
              {user?.username ?? 'Loading…'}
            </p>
            <p className="truncate text-[10px] text-slate-500">
              {user ? ROLE_LABELS[normalizeRole(user.role)] : 'Portal user'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-600 outline-none transition-all hover:bg-rose-100 active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
