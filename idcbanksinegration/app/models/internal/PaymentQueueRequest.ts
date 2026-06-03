import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
} from 'sequelize-typescript';

interface PaymentQueueRequestAttributes {
  id: number;
  queueId: string;
  paymentId: string;
  bankCode: string;
  sourceBank?: string | null;
  paymentPayload: string;
  status: string;
  attempts: number;
  lastError?: string;
  responsePayload?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PaymentQueueRequestCreationAttributes extends Omit<PaymentQueueRequestAttributes, 'id' | 'createdAt' | 'updatedAt'> {
  id?: number;
}

@Table({
  tableName: 'payment_queue_requests',
  timestamps: true,
  underscored: true,
})
export class PaymentQueueRequest extends Model<PaymentQueueRequest, PaymentQueueRequestCreationAttributes> {
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
    field: 'queue_id',
    allowNull: false,
    unique: true,
  })
  declare queueId: string;

  @Column({
    type: DataType.STRING(100),
    field: 'payment_id',
    allowNull: false,
  })
  declare paymentId: string;

  @Column({
    type: DataType.STRING(20),
    field: 'bank_code',
    allowNull: false,
  })
  declare bankCode: string;

  @AllowNull
  @Column({
    type: DataType.STRING(100),
    field: 'source_bank',
    allowNull: true,
  })
  declare sourceBank?: string;

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

  @Column({
    type: DataType.INTEGER,
    field: 'attempts',
    allowNull: false,
    defaultValue: 0,
  })
  declare attempts: number;

  @AllowNull
  @Column({
    type: DataType.TEXT,
    field: 'last_error',
    allowNull: true,
  })
  declare lastError?: string;

  @AllowNull
  @Column({
    type: DataType.TEXT,
    field: 'response_payload',
    allowNull: true,
  })
  declare responsePayload?: string;
}
