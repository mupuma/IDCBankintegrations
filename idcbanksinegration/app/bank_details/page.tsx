'use client';

import { useState, useEffect, useCallback } from 'react'; // ← FIX 1: Added useCallback
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types & Interfaces ---

interface PhysicalAddress {
  streetName: string;
  town: string;
  plotNo: string;
}

interface Venbank {
  id: number;
  vendorid: string;
  accven: string;
  accname: string;
  bankid: string;
  sortcde: string;
  brnch: string;
  swiftcde: string;
  countryOfOrigin: string;
  email: string;
  phoneNumber: string;
  physicalAddress: PhysicalAddress;
}

interface Notification {
  show: boolean;
  message: string;
  type: 'success' | 'error' | '';
}

// --- Shared Layout Wrapper Component ---

interface BaseModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
}

function BaseModal({ open, onClose, title, icon, children, footer }: BaseModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 25 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 25 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative z-[101] overflow-hidden border border-slate-100"
          >
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 text-slate-700 border border-slate-100 rounded-xl">
                  {icon}
                </div>
                <h3 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h3>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors outline-none"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-slate-50/40 space-y-5">
              {children}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3 sticky bottom-0 z-10">
              {footer}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// --- Visual Structural Cards Layout ---

interface DisplayCardProps {
  title: string;
  children: React.ReactNode;
  accentColor?: 'blue' | 'emerald' | 'violet' | 'amber';
}

function DisplayCard({ title, children, accentColor = 'blue' }: DisplayCardProps) {
  const accentMap = {
    blue: 'text-blue-600 border-blue-500 bg-blue-50/50',
    emerald: 'text-emerald-600 border-emerald-500 bg-emerald-50/50',
    violet: 'text-violet-600 border-violet-500 bg-violet-50/50',
    amber: 'text-amber-600 border-amber-500 bg-amber-50/50',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden p-5 transition-all">
      <h4 className={`text-xs font-bold uppercase tracking-widest mb-4 pb-2 border-b border-slate-100 flex items-center gap-2 ${accentMap[accentColor].split(' ')[0]}`}>
        <span className={`w-1.5 h-3.5 rounded-sm border-l-4 ${accentMap[accentColor].split(' ')[1]}`} />
        {title}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {children}
      </div>
    </div>
  );
}

// --- Read Only Details Submodule Block ---

function DataField({ label, value, isMono = false }: { label: string; value: string; isMono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`text-slate-800 font-medium text-sm truncate ${isMono ? 'font-mono text-blue-600 font-semibold' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

// --- Read Only Modal View Component ---

function BankViewModal({ open, onClose, data }: { open: boolean; onClose: () => void; data: Venbank | null }) {
  if (!data) return null;

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={`Bank Details — ${data.vendorid}`}
      icon={
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      }
      footer={
        <button 
          onClick={onClose} 
          className="px-5 py-2 bg-slate-800 text-white font-semibold rounded-xl text-sm hover:bg-slate-900 transition-all shadow-sm outline-none"
        >
          Close View
        </button>
      }
    >
      <DisplayCard title="Bank Account Information" accentColor="blue">
        <DataField label="Vendor ID" value={data.vendorid} />
        <DataField label="Account Number" value={data.accven} isMono />
        <div className="md:col-span-2">
          <DataField label="Account Name" value={data.accname} />
        </div>
      </DisplayCard>
      <DisplayCard title="Banking & SWIFT Details" accentColor="emerald">
        <DataField label="Bank ID" value={data.bankid} />
        <DataField label="Sort Code" value={data.sortcde} isMono />
        <DataField label="Branch Location" value={data.brnch} />
        <DataField label="SWIFT Code" value={data.swiftcde} isMono />
      </DisplayCard>
      <DisplayCard title="Physical Address Details" accentColor="violet">
        <DataField label="Plot No" value={data.physicalAddress?.plotNo || ''} />
        <DataField label="Street Name" value={data.physicalAddress?.streetName || ''} />
        <DataField label="Town/City" value={data.physicalAddress?.town || ''} />
        <DataField label="Country of Origin" value={data.countryOfOrigin} />
      </DisplayCard>
      <DisplayCard title="Contact Information" accentColor="amber">
        <DataField label="Email Address" value={data.email} />
        <DataField label="Phone Number" value={data.phoneNumber} />
      </DisplayCard>
    </BaseModal>
  );
}

// --- Bank Form Modal Component (Create / Edit Layout Setup) ---

interface BankFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: Venbank | null;
  vendorOptions: string[];
}

function BankFormModal({ open, onClose, onSubmit, initialData, vendorOptions }: BankFormProps) {
  const [formData, setFormData] = useState({
    vendorid: '',
    accven: '',
    accname: '',
    bankid: '',
    sortcde: '',
    brnch: '',
    swiftcde: '',
    streetName: '',
    town: '',
    plotNo: '',
    countryOfOrigin: '',
    email: '',
    phoneNumber: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        vendorid: initialData.vendorid || '',
        accven: initialData.accven || '',
        accname: initialData.accname || '',
        bankid: initialData.bankid || '',
        sortcde: initialData.sortcde || '',
        brnch: initialData.brnch || '',
        swiftcde: initialData.swiftcde || '',
        streetName: initialData.physicalAddress?.streetName || '',
        town: initialData.physicalAddress?.town || '',
        plotNo: initialData.physicalAddress?.plotNo || '',
        countryOfOrigin: initialData.countryOfOrigin || '',
        email: initialData.email || '',
        phoneNumber: initialData.phoneNumber || '',
      });
    } else {
      setFormData({
        vendorid: '', accven: '', accname: '', bankid: '', sortcde: '',
        brnch: '', swiftcde: '', streetName: '', town: '', plotNo: '',
        countryOfOrigin: '', email: '', phoneNumber: '',
      });
    }
  }, [initialData, open]);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendorid || !formData.accname) return;
    
    onSubmit({
      ...formData,
      physicalAddress: {
        streetName: formData.streetName,
        town: formData.town,
        plotNo: formData.plotNo,
      },
    });
  };

  const isEditMode = Boolean(initialData?.id);
  const formInputStyle = "w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white border-slate-200 outline-none transition-all placeholder:text-slate-400 font-medium text-slate-800";
  const labelStyle = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5";

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={initialData ? 'Edit Bank Account Record' : 'Add New Bank Account'}
      icon={
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white text-slate-600 border border-slate-200 font-semibold rounded-xl text-sm hover:bg-slate-50 transition-all outline-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleFormSubmit}
            disabled={!formData.vendorid || !formData.accname || (!isEditMode && vendorOptions.length === 0)}
            className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md shadow-blue-100 outline-none"
          >
            {initialData ? 'Save Changes' : 'Create Account'}
          </button>
        </>
      }
    >
      <form onSubmit={handleFormSubmit} className="space-y-5">
        <DisplayCard title="Bank Account Information" accentColor="blue">
          <div>
            <label className={labelStyle}>Vendor ID *</label>
            {isEditMode ? (
              <input
                type="text"
                disabled
                className={`${formInputStyle} bg-slate-100 cursor-not-allowed`}
                value={formData.vendorid}
              />
            ) : (
              <select
                required
                className={formInputStyle}
                value={formData.vendorid}
                onChange={handleChange('vendorid')}
              >
                <option value="">Select vendor ID</option>
                {vendorOptions.map((vendor) => (
                  <option key={vendor} value={vendor}>{vendor}</option>
                ))}
              </select>
            )}
            {!isEditMode && vendorOptions.length === 0 && (
              <p className="text-xs text-rose-600 mt-2">No available vendor IDs to assign. Either all vendor master entries already have bank details or the vendor list could not be loaded.</p>
            )}
          </div>
          <div>
            <label className={labelStyle}>Account Number</label>
            <input type="text" className={`${formInputStyle} font-mono`} placeholder="e.g. 1234567890" value={formData.accven} onChange={handleChange('accven')} />
          </div>
          <div className="md:col-span-2">
            <label className={labelStyle}>Account Name *</label>
            <input type="text" required className={formInputStyle} placeholder="e.g. Enterprise Solutions Corp" value={formData.accname} onChange={handleChange('accname')} />
          </div>
        </DisplayCard>
        <DisplayCard title="Banking & SWIFT Details" accentColor="emerald">
          <div>
            <label className={labelStyle}>Bank ID</label>
            <input type="text" className={formInputStyle} placeholder="e.g. BNK01" value={formData.bankid} onChange={handleChange('bankid')} />
          </div>
          <div>
            <label className={labelStyle}>Sort Code</label>
            <input type="text" className={`${formInputStyle} font-mono`} placeholder="e.g. 20-00-00" value={formData.sortcde} onChange={handleChange('sortcde')} />
          </div>
          <div>
            <label className={labelStyle}>Branch</label>
            <input type="text" className={formInputStyle} placeholder="e.g. Main Street Branch" value={formData.brnch} onChange={handleChange('brnch')} />
          </div>
          <div>
            <label className={labelStyle}>SWIFT Code</label>
            <input type="text" className={`${formInputStyle} font-mono`} placeholder="e.g. ABBYGB2L" value={formData.swiftcde} onChange={handleChange('swiftcde')} />
          </div>
        </DisplayCard>
        <DisplayCard title="Physical Address & Contact Details" accentColor="violet">
          <div>
            <label className={labelStyle}>Plot No</label>
            <input type="text" className={formInputStyle} placeholder="e.g. Suite 4B" value={formData.plotNo} onChange={handleChange('plotNo')} />
          </div>
          <div>
            <label className={labelStyle}>Street Name</label>
            <input type="text" className={formInputStyle} placeholder="e.g. Innovation Way" value={formData.streetName} onChange={handleChange('streetName')} />
          </div>
          <div>
            <label className={labelStyle}>Town/City</label>
            <input type="text" className={formInputStyle} placeholder="e.g. London" value={formData.town} onChange={handleChange('town')} />
          </div>
          <div>
            <label className={labelStyle}>Country</label>
            <input type="text" className={formInputStyle} placeholder="e.g. United Kingdom" value={formData.countryOfOrigin} onChange={handleChange('countryOfOrigin')} />
          </div>
          <div>
            <label className={labelStyle}>Email</label>
            <input type="email" className={formInputStyle} placeholder="e.g. finance@vendor.com" value={formData.email} onChange={handleChange('email')} />
          </div>
          <div>
            <label className={labelStyle}>Phone Number</label>
            <input type="text" className={formInputStyle} placeholder="e.g. +44 20 7946 0958" value={formData.phoneNumber} onChange={handleChange('phoneNumber')} />
          </div>
        </DisplayCard>
      </form>
    </BaseModal>
  );
}

// --- Main Application Component Layout ---

export default function BankManagementPage() {
  const [banks, setBanks] = useState<Venbank[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [vendorOptions, setVendorOptions] = useState<string[]>([]);
  
  // FIX 2: Added debounced state variables
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [debouncedFilterVendor, setDebouncedFilterVendor] = useState('');
  
  const [openForm, setOpenForm] = useState(false);
  const [openViewModal, setOpenViewModal] = useState(false);
  const [editingBank, setEditingBank] = useState<Venbank | null>(null);
  const [viewingBank, setViewingBank] = useState<Venbank | null>(null);
  
  const [notification, setNotification] = useState<Notification>({
    show: false, message: '', type: '',
  });

  const router = useRouter();

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 4000);
  };

  const redirectToLogin = () => {
    showNotification('Session expired. Redirecting to login.', 'error');
    router.push('/login');
  };

  // Debounce search and filter inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilterVendor(filterVendor);
    }, 500);
    return () => clearTimeout(timer);
  }, [filterVendor]);

  // Reset page when search/filter changes
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchTerm, debouncedFilterVendor]);

  const fetchBanks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(), // 0-indexed
        limit: rowsPerPage.toString(),
      });
      
      if (debouncedSearchTerm.trim()) {
        params.append('search', debouncedSearchTerm.trim());
      }
      
      if (debouncedFilterVendor.trim()) {
        params.append('vendorid', debouncedFilterVendor.trim());
      }

      console.log('Fetching with params:', params.toString());

      const response = await fetch(`/api/v1/bank_details?${params}`);
      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Network response failure exception.');
      }
      const data = await response.json();
      
      console.log('API Response:', data);
      
      if (data.success) {
        setBanks(Array.isArray(data.data) ? data.data : []);
        setTotalItems(data.pagination?.totalItems || 0);
      } else {
        setBanks([]);
        setTotalItems(0);
        showNotification(data.error || 'Failed to load data', 'error');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      showNotification('Failed to load bank records from Sage.', 'error');
      setBanks([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, debouncedSearchTerm, debouncedFilterVendor, router]);

  const fetchVendorOptions = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/vendors');
      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      if (!response.ok) throw new Error('Failed to load available vendor IDs.');
      const data = await response.json();
      setVendorOptions(data.data || []);
    } catch (error) {
      console.error('Vendor options fetch error:', error);
      setVendorOptions([]);
    }
  }, [router]);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  useEffect(() => {
    fetchVendorOptions();
  }, [fetchVendorOptions]);

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to permanently remove this financial distribution record?')) {
      try {
        const response = await fetch(`/api/v1/bank_details/${id}`, { method: 'DELETE' });
        if (response.status === 401) {
          redirectToLogin();
          return;
        }
        if (response.ok) {
          showNotification('Bank ledger entry removed successfully.', 'success');
          fetchBanks();
          fetchVendorOptions();
        } else {
          throw new Error();
        }
      } catch (error) {
        showNotification('Authorization error: Unable to purge target bank module record.', 'error');
      }
    }
  };

  const handleSubmitForm = async (formData: any) => {
    try {
      const url = editingBank ? `/api/v1/bank_details/${editingBank.id}` : '/api/v1/bank_details';
      const method = editingBank ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (response.ok) {
        showNotification(`Bank record successfully ${editingBank ? 'updated' : 'instantiated'}.`, 'success');
        setOpenForm(false);
        setEditingBank(null);
        fetchBanks();
        if (!editingBank) fetchVendorOptions();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'System transaction validation error.');
      }
    } catch (error: any) {
      console.error('Submit structure anomaly:', error);
      showNotification(error.message || 'Operation rejected. Review standard structural formatting parameters.', 'error');
    }
  };

  const startItem = banks.length > 0 ? page * rowsPerPage + 1 : 0;
  const endItem = Math.min((page + 1) * rowsPerPage, totalItems);
  const hasNext = (page + 1) * rowsPerPage < totalItems;

  return (
    <>
      {/* Toast Notification */}
      <AnimatePresence>
        {notification.show && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] max-w-md w-full"
          >
            <div className={`p-4 rounded-xl shadow-xl flex items-center gap-3 border ${
              notification.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                : 'bg-rose-50 text-rose-800 border-rose-100'
            }`}>
              {notification.type === 'success' ? (
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-5 h-5 text-rose-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              )}
              <p className="text-sm font-semibold">{notification.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dashboard Header */}
      <div className="mb-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-xl p-6 md:p-8 text-white relative overflow-hidden border border-slate-950">
        <div className="relative z-10 max-w-3xl">
          <span className="text-xs uppercase font-bold tracking-widest text-blue-400 bg-blue-900/40 border border-blue-800/50 px-3 py-1 rounded-full">Financial Operations</span>
          <h1 className="text-3xl md:text-4xl font-extrabold mt-3 tracking-tight">Vendor Bank Details Ledger</h1>
          <p className="text-slate-300 text-sm md:text-base font-medium mt-2 leading-relaxed opacity-90">
            Secure tracking matrix managing global vendor disbursement configurations.
          </p>
        </div>
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by account names, bank identifiers, locations..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-400 font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Filter Vendor ID"
              className="px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-400 font-medium w-full md:w-40"
              value={filterVendor}
              onChange={(e) => setFilterVendor(e.target.value)}
            />
            <button
              onClick={() => { setEditingBank(null); setOpenForm(true); }}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-100 whitespace-nowrap outline-none active:scale-98"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add Record
            </button>
            <button
              onClick={fetchBanks}
              className="p-2.5 bg-slate-100 text-slate-600 border border-slate-200/50 rounded-xl hover:bg-slate-200/70 transition-all outline-none"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/60">
                {['Vendor', 'Account Identity Data', 'Banking Infrastructure', 'Branch Location', 'Contact Details', ''].map((head, index) => (
                  <th key={index} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="inline-block animate-spin rounded-full h-7 w-7 border-3 border-blue-600 border-t-transparent" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-3">Fetching Ledger Matrix...</p>
                  </td>
                </tr>
              ) : banks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm font-semibold text-slate-400">
                    No verified banking registry matching filtering constraints located.
                  </td>
                </tr>
              ) : (
                banks.map((bank) => (
                  <tr key={bank.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200/40 uppercase tracking-wide">
                        {bank.vendorid}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-[220px]">
                      <div className="text-sm font-bold text-slate-800 truncate">{bank.accname}</div>
                      <div className="text-xs font-mono text-slate-400 mt-0.5 tracking-tight">{bank.accven || '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-700 font-semibold">{bank.bankid || '—'}</div>
                      <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                        Sort: <span className="font-mono text-slate-500 font-semibold">{bank.sortcde || '—'}</span> | SWIFT: <span className="font-mono text-slate-500 font-semibold">{bank.swiftcde || '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {bank.physicalAddress?.town ? (
                        <>
                          <div className="font-medium text-slate-700 truncate max-w-[180px]">
                            {bank.physicalAddress.plotNo || ''} {bank.physicalAddress.streetName || ''}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 font-medium">
                            {bank.physicalAddress.town}, <span className="uppercase tracking-wide font-bold text-[10px]">{bank.countryOfOrigin || '—'}</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-500">
                      <div className="truncate max-w-[160px] text-slate-700 font-semibold">{bank.email || '—'}</div>
                      {bank.phoneNumber && <div className="text-[11px] text-slate-400 mt-0.5">{bank.phoneNumber}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setViewingBank(bank); setOpenViewModal(true); }} 
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all outline-none"
                          title="View"
                        >
                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button 
                          onClick={() => { setEditingBank(bank); setOpenForm(true); }} 
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all outline-none"
                          title="Edit"
                        >
                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button 
                          onClick={() => handleDelete(bank.id)} 
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all outline-none"
                          title="Delete"
                        >
                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs font-semibold text-slate-500">
            {banks.length > 0 ? (
              `Showing ${startItem} – ${endItem} of ${totalItems} structural records`
            ) : (
              'No records found'
            )}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Per Page:</span>
              <select 
                value={rowsPerPage} 
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {[5, 10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <div className="flex gap-1">
              <button
                disabled={page === 0 || loading}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 transition-all outline-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                disabled={!hasNext || loading}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 transition-all outline-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals - FIX 3: These are now defined before being used */}
      <BankViewModal 
        open={openViewModal} 
        onClose={() => { setOpenViewModal(false); setViewingBank(null); }} 
        data={viewingBank} 
      />

      <BankFormModal 
        open={openForm} 
        onClose={() => { setOpenForm(false); setEditingBank(null); }} 
        onSubmit={handleSubmitForm} 
        initialData={editingBank} 
        vendorOptions={vendorOptions}
      />
    </>
  );
}