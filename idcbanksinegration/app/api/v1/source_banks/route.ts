import { NextResponse } from 'next/server';
import { connectSageDatabase } from '@/app/lib/sageDb';
import { Bkacct } from '@/app/models/sage_entities/Bkacct';

export async function GET() {
  try {
    await connectSageDatabase();
    const banks = await Bkacct.findAll({ where: { inactive : 0 }, limit: 500 });
    const rows = banks.map((b) => {
      const r = (b as any).toJSON ? (b as any).toJSON() : b;
      return {
        bank: r.BANK || r.bank,
        name: r.NAME || r.name || null,
        accountNumber: r.BKACCT || r.bkacct || null,
        addr1: r.ADDR1 || r.addr1 || null,
        addr2: r.ADDR2 || r.addr2 || null,
        addr3: r.ADDR3 || r.addr3 || null,
        addr4: r.ADDR4 || r.addr4 || null,
        city: r.CITY || r.city || null,
        state: r.STATE || r.state || null,
        country: r.COUNTRY || r.country || null,
        postal: r.POSTAL || r.postal || null,
        contact: r.CONTACT || r.contact || null,
        phone: r.PHONE || r.phone || null,
        fax: r.FAX || r.fax || null,
        transit: r.TRANSIT || r.transit || null,
        multicur: r.MULTICUR ?? r.multicur ?? null,
        inactive: r.INACTIVE ?? r.inactive ?? null,
        postdate: r.POSTDATE ?? r.postdate ?? null,
        idacct: r.IDACCT || r.idacct || null,
        reccomment: r.RECCOMMENT || r.reccomment || null,
      };
    });

    return NextResponse.json({ success: true, items: rows });
  } catch (error: any) {
    console.error('Failed to load source banks', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to load source banks' }, { status: 500 });
  }
}
