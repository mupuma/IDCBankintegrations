'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function BankDetailsSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    {
      name: 'Vendor Bank Details',
      href: '/bank_details',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
    {
      name: 'Posted Payments',
      href: '/bank_details/payments',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      name: 'Payment Queues',
      href: '/bank_details/payment_queues',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18M6 4v16M18 4v16" />
        </svg>
      ),
    },
  ];

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) router.push('/login');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 bg-white border-r border-slate-200 flex flex-col z-50">
     
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-50">
        <div className="flex items-center gap-3">
          {/* <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
           
              
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 14v20m4-3V4m4 8V4" />
            </svg>
          </div> */}
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight"><img src="/idc_logo.png" alt="IDC Logo" className="w-100 h-10 object-contain" /></h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payments Portal</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">
          Core Operations
        </p>
        
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 relative ${
                isActive 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {/* Active Indicator Pill */}
              {isActive && (
                <div className="absolute left-0 w-1 h-6 bg-blue-600 rounded-r-full" />
              )}
              
              <span className={`transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                {item.icon}
              </span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User / Bottom Section */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="mb-4 px-2 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white overflow-hidden shadow-sm">
             <div className="w-full h-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-[10px] text-white font-bold">
               AD
             </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">Admin User</p>
            <p className="text-[10px] text-slate-500 truncate">System Manager</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 transition-all active:scale-95 outline-none"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}