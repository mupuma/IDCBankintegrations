import type { Metadata } from 'next';
import BankDetailsSidebar from './BankDetailsSidebar';

export const metadata: Metadata = {
  title: 'Bank Details',
  description: 'Vendor bank details and PA navigation',
};

export default function BankDetailsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex"> {/* Slightly softer blue-gray background */}
      <BankDetailsSidebar />

      {/* Main Content Area */}
      <main className="flex-1 ml-72 min-h-screen">
        {/* Remove the md:p-8 and max-w-7xl. Use p-6 for a tighter fit */}
        <div className="p-6 w-full">
          {children}
        </div>
      </main>
    </div>
  );
}