// models/Venbank.ts
import { 
  Model, 
  Table, 
  Column, 
  DataType, 
  PrimaryKey,
  AutoIncrement
} from 'sequelize-typescript';
import type { PhysicalAddress } from '../dtos';
import { VenbankCreationAttributes } from '@/app/lib/types';




@Table({
  tableName: 'vendor_bank_details',
  timestamps: true,
  paranoid: true,
  underscored: true
})
export class VendorBankDetail extends Model<VendorBankDetail, VenbankCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column({
    type: DataType.INTEGER,
    field: 'ID',
    allowNull: false,
    autoIncrement: true
  })
 declare id: number;

  @Column({
    type: DataType.STRING(12),
    field: 'VENDORID',
    allowNull: false,
    unique: true
  })
 declare vendorid?: string;

  @Column({
    type: DataType.STRING(50),
    field: 'ACCVEN',
    allowNull: true
  })
 declare accven?: string;

  @Column({
    type: DataType.STRING(255),
    field: 'ACCNAME',
    allowNull: true
  })
 declare accname?: string;

  @Column({
    type: DataType.STRING(20),
    field: 'BANKID',
    allowNull: true
  })
  declare bankid?: string;

  @Column({
    type: DataType.STRING(20),
    field: 'SORTCDE',
    allowNull: true
  })
  declare sortcde?: string;

  @Column({
    type: DataType.STRING(255),
    field: 'BRNCH',
    allowNull: true
  })
  declare brnch?: string;

  @Column({
    type: DataType.STRING(20),
    field: 'SWIFTCDE',
    allowNull: true
  })
  declare swiftcde?: string;

  @Column({ type: DataType.STRING(20), field: 'TPIN', allowNull: true })
  declare tpin?: string;

  @Column({ type: DataType.STRING(8), field: 'PURPOSE_CODE', allowNull: true })
  declare purposeCode?: string;

  @Column({ type: DataType.STRING(8), field: 'SECTOR_CODE', allowNull: true })
  declare sectorCode?: string;

  @Column({
    type: DataType.JSON,
    field: 'PHYSICAL_ADDRESS',
    allowNull: true
  })
  declare physicalAddress?: PhysicalAddress;

  @Column({
    type: DataType.STRING(100),
    field: 'COUNTRY_OF_ORIGIN',
    allowNull: true
  })
  declare countryOfOrigin?: string;

  @Column({
    type: DataType.STRING(255),
    field: 'EMAIL',
    allowNull: true
  })
  declare email?: string;

  @Column({
    type: DataType.STRING(255),
    field: 'PHONE_NUMBER',
    allowNull: true
  })
  declare phoneNumber?: string;
}
