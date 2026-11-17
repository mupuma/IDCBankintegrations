import type { Metadata } from 'next';
import BankDetailsSidebar from './BankDetailsSidebar';

export const metadata: Metadata = {
  title: 'Bank Details',
  description: 'Vendor bank details and PA navigation',
};

export default function BankDetailsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex" style={{ colorScheme: 'light' }}> {/* Slightly softer blue-gray background */}
      <BankDetailsSidebar />

      {/* Main Content Area */}
      {/* min-w-0 lets wide tables scroll inside their own box instead of widening the page.
          Below lg the sidebar is a drawer and a 56px top bar sits above the content. */}
      <main className="min-w-0 flex-1 min-h-screen pt-14 lg:ml-72 lg:pt-0">
        <div className="w-full p-4 sm:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}