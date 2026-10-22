import { VendorBankDetail } from '../models/internal/VendorBankDetail';
import { loadSageVendors } from './sageVendors';
import { buildVendorBankDetails, loadVendorOptionalFields } from './sageVendorBankDetails';

export async function syncSageVendorMaster() {
  let stage = 'sage_read';
  try {
    const vendors = await loadSageVendors();
    stage = 'portal_save';
    const existing = await VendorBankDetail.findAll({ attributes: ['vendorid'], raw: true, paranoid: false });
    const known = new Set(existing.map(row => String(row.vendorid || '').trim()));
    const missing = vendors.filter(vendor => {
      const id = String(vendor.vendorid || '').trim();
      if (!id || known.has(id)) return false;
      known.add(id); return true;
    });
    let addedCount = 0;
    for (let offset = 0; offset < missing.length; offset += 200) {
      const batch = missing.slice(offset, offset + 200);
      stage = 'sage_read';
      const optional = await loadVendorOptionalFields(batch.map(row => row.vendorid));
      const seeds = batch.map(vendor => {
        const vendorid = vendor.vendorid.trim();
        const details = buildVendorBankDetails({ vendorId: vendorid, vendorName: vendor.vendname,
          vendorEmail: vendor.email, vendorPhone: vendor.phoneNumber, addressLine1: vendor.addressLine1,
          plotNo: vendor.addressLine2, town: vendor.city, country: vendor.country, taxNumber: vendor.taxNumber,
          optionalFields: optional.get(vendorid) });
        return { vendorid, accven: details.accountNumber, accname: details.accountName,
          bankid: details.bankName, sortcde: details.sortCode, brnch: details.branchCode,
          swiftcde: details.swiftCode, tpin: details.tpin, purposeCode: details.purposeCode,
          sectorCode: details.sectorCode, physicalAddress: details.physicalAddress,
          countryOfOrigin: details.countryOfOrigin, email: details.email, phoneNumber: details.phoneNumber };
      });
      stage = 'portal_save';
      try {
        // Do not use INSERT IGNORE: it can silently truncate source values.
        await VendorBankDetail.bulkCreate(seeds, { validate: true });
        addedCount += seeds.length;
      } catch (error) {
        if ((error as { name?: string }).name !== 'SequelizeUniqueConstraintError') throw error;
        // Concurrent sync may have inserted this batch. Preserve its records,
        // including deleted records; never overwrite or silently truncate data.
        for (const seed of seeds) {
          const [, created] = await VendorBankDetail.findOrCreate({ where: { vendorid: seed.vendorid }, defaults: seed, paranoid: false });
          if (created) addedCount++;
        }
      }
    }
    return { sageVendorCount: vendors.length, addedCount };
  } catch (cause) {
    throw Object.assign(new Error('Sage vendor master sync failed'), { importStage: stage, cause });
  }
}
