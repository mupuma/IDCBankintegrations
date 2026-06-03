// models/ProcessedTransaction.ts with timestamps
import { 
  Model, 
  Table, 
  Column, 
  DataType, 
  PrimaryKey 
} from 'sequelize-typescript';

interface ProcessedTransactionAttributes {
  transactionId: string;
  bankCode: string;
  description: string;
  noEntries: number;
  creditAmount: number;
  debitAmount: number;
  statusCode: number;
  statusMessage?: string;
  processedDate: Date;
}

interface ProcessedTransactionCreationAttributes extends ProcessedTransactionAttributes {}

@Table({
  tableName: 'processed_transactions',
  timestamps: true, // Enable timestamps
  createdAt: 'created_at', // Custom column name
  updatedAt: 'updated_at', // Custom column name
  underscored: true
})
export class ProcessedTransaction extends Model<ProcessedTransaction, ProcessedTransactionCreationAttributes> {
  @PrimaryKey
  @Column({
    type: DataType.STRING(50),
    field: 'transaction_id',
    allowNull: false
  })
  transactionId!: string;

  @Column({
    type: DataType.STRING(12),
    field: 'bank_code',
    allowNull: false
  })
  bankCode!: string;

  @Column({
    type: DataType.STRING(30),
    field: 'description',
    allowNull: false
  })
  description!: string;

  @Column({
    type: DataType.INTEGER,
    field: 'noEntries',
    allowNull: false
  })
  noEntries!: number;

  @Column({
    type: DataType.DOUBLE(4, 2),
    field: 'credit_amount',
    allowNull: false
  })
  creditAmount!: number;

  @Column({
    type: DataType.DOUBLE(4, 2),
    field: 'debit_amount',
    allowNull: false
  })
  debitAmount!: number;

  @Column({
    type: DataType.INTEGER,
    field: 'status_code',
    allowNull: false
  })
  statusCode!: number;

  @Column({
    type: DataType.STRING(255),
    field: 'status_message',
    allowNull: true
  })
  statusMessage?: string;

  @Column({
    type: DataType.DATE,
    field: 'processed_date',
    allowNull: false
  })
  processedDate!: Date;

  // Sequelize will automatically add:
  // createdAt!: Date;
  // updatedAt!: Date;
}