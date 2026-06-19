import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
} from 'sequelize-typescript';

interface SourceAccountAttributes {
  id: number;
  bank: string;
  name?: string | null;
  accountNumber?: string | null;
  branchCode?: string | null;
  contact?: string | null;
  phone?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SourceAccountCreationAttributes
  extends Omit<SourceAccountAttributes, 'id' | 'createdAt' | 'updatedAt'> {
  id?: number;
}

@Table({
  tableName: 'source_accounts',
  timestamps: true,
  underscored: true,
})
export class SourceAccount extends Model<SourceAccount, SourceAccountCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column({
    type: DataType.BIGINT,
    field: 'id',
    allowNull: false,
    autoIncrement: true,
  })
  declare id: number;

  @Column({
    type: DataType.STRING(8),
    field: 'bank',
    allowNull: false,
    unique: true,
  })
  declare bank: string;

  @AllowNull
  @Column({
    type: DataType.STRING(120),
    field: 'name',
    allowNull: true,
  })
  declare name?: string | null;

  @AllowNull
  @Column({
    type: DataType.STRING(50),
    field: 'account_number',
    allowNull: true,
  })
  declare accountNumber?: string | null;

  @AllowNull
  @Column({
    type: DataType.STRING(20),
    field: 'branch_code',
    allowNull: true,
  })
  declare branchCode?: string | null;

  @AllowNull
  @Column({
    type: DataType.STRING(60),
    field: 'contact',
    allowNull: true,
  })
  declare contact?: string | null;

  @AllowNull
  @Column({
    type: DataType.STRING(30),
    field: 'phone',
    allowNull: true,
  })
  declare phone?: string | null;

  @Column({
    type: DataType.BOOLEAN,
    field: 'is_active',
    allowNull: false,
    defaultValue: true,
  })
  declare isActive: boolean;

  @AllowNull
  @Column({
    type: DataType.STRING(255),
    field: 'notes',
    allowNull: true,
  })
  declare notes?: string | null;
}

export default SourceAccount;
