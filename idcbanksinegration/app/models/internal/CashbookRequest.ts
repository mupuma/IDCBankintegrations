import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
} from 'sequelize-typescript';

interface CashbookRequestAttributes {
  id: number;
  transactionId: string;
  payload: string;
  status: string;
  attempts: number;
  lastError?: string;
  responsePayload?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CashbookRequestCreationAttributes extends Omit<CashbookRequestAttributes, 'id' | 'createdAt' | 'updatedAt'> {
  id?: number;
}

@Table({
  tableName: 'cashbook_requests',
  timestamps: true,
  underscored: true,
})
export class CashbookRequest extends Model<CashbookRequest, CashbookRequestCreationAttributes> {
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
    unique: true,
  })
  declare transactionId: string;

  @Column({
    type: DataType.TEXT,
    field: 'payload',
    allowNull: false,
  })
  declare payload: string;

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

export default CashbookRequest;
