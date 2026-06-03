import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
} from 'sequelize-typescript';

interface CashbookReceiptAttributes {
  id: number;
  transactionId: string;
  bankCode: string;
  description: string;
  noEntries: number;
  creditAmount: number;
  debitAmount: number;
  paymentPayload: string;
  status: string;
  statusMessage?: string;
  processedDate?: Date;
}

interface CashbookReceiptCreationAttributes extends Omit<CashbookReceiptAttributes, 'id' | 'processedDate'> {
  id?: number;
}

@Table({
  tableName: 'cashbook_receipts',
  timestamps: true,
  underscored: true,
})
export class CashbookReceipt extends Model<CashbookReceipt, CashbookReceiptCreationAttributes> {
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
    type: DataType.STRING(100),
    field: 'transaction_id',
    allowNull: false,
  })
  declare transactionId: string;

  @Column({
    type: DataType.STRING(20),
    field: 'bank_code',
    allowNull: false,
  })
  declare bankCode: string;

  @Column({
    type: DataType.STRING(255),
    field: 'description',
    allowNull: false,
  })
  declare description: string;

  @Column({
    type: DataType.INTEGER,
    field: 'no_entries',
    allowNull: false,
  })
  declare noEntries: number;

  @Column({
    type: DataType.DOUBLE,
    field: 'credit_amount',
    allowNull: false,
  })
  declare creditAmount: number;

  @Column({
    type: DataType.DOUBLE,
    field: 'debit_amount',
    allowNull: false,
  })
  declare debitAmount: number;

  @Column({
    type: DataType.TEXT,
    field: 'payment_payload',
    allowNull: false,
  })
  declare paymentPayload: string;

  @Column({
    type: DataType.STRING(32),
    field: 'status',
    allowNull: false,
  })
  declare status: string;

  @AllowNull
  @Column({
    type: DataType.STRING(255),
    field: 'status_message',
    allowNull: true,
  })
  declare statusMessage?: string;

  @AllowNull
  @Column({
    type: DataType.DATE,
    field: 'processed_date',
    allowNull: true,
  })
  declare processedDate?: Date;
}
