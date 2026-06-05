import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
} from 'sequelize-typescript';

interface IzbPaymentAttributes {
  id: number;
  paymentId: string;
  paymentDate?: Date | null;
  sourceBank?: string | null;
  paymentPayload: string;
  status: string;
  attempts: number;
  pulledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface IzbPaymentCreationAttributes extends Omit<IzbPaymentAttributes, 'id' | 'createdAt' | 'updatedAt'> {
  id?: number;
}

@Table({
  tableName: 'izb_pending_payments',
  timestamps: true,
  underscored: true,
})
export class IzbPayment extends Model<IzbPayment, IzbPaymentCreationAttributes> {
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
    field: 'payment_id',
    allowNull: false,
  })
  declare paymentId: string;

  @AllowNull
  @Column({
    type: DataType.DATE,
    field: 'payment_date',
    allowNull: true,
  })
  declare paymentDate?: Date | null;

  @AllowNull
  @Column({
    type: DataType.STRING(100),
    field: 'source_bank',
    allowNull: true,
  })
  declare sourceBank?: string | null;

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
    type: DataType.DATE,
    field: 'pulled_at',
    allowNull: true,
  })
  declare pulledAt?: Date | null;
}

export default IzbPayment;
