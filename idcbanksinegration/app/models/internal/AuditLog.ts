import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
} from 'sequelize-typescript';

export type AuditAction =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PAYMENT_POSTED'
  | 'BANK_DETAILS_CREATED'
  | 'BANK_DETAILS_UPDATED'
  | 'BANK_DETAILS_DELETED'
  | 'CASHBOOK_POSTED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'SOURCE_ACCOUNT_CREATED'
  | 'SOURCE_ACCOUNT_UPDATED'
  | 'SOURCE_ACCOUNT_DELETED'
  | 'ACCESS_DENIED';

interface AuditLogAttributes {
  id: number;
  userId: number | null;
  username: string | null;
  action: AuditAction;
  resourceType: string | null;
  resourceId: string | null;
  summary: string;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

interface AuditLogCreationAttributes
  extends Omit<AuditLogAttributes, 'id' | 'createdAt'> {
  id?: number;
}

@Table({
  tableName: 'audit_logs',
  timestamps: true,
  updatedAt: false,
  underscored: true,
})
export class AuditLog extends Model<AuditLog, AuditLogCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT, field: 'id', allowNull: false, autoIncrement: true })
  declare id: number;

  @AllowNull(true)
  @Column({ type: DataType.BIGINT, field: 'user_id', allowNull: true })
  declare userId: number | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(255), field: 'username', allowNull: true })
  declare username: string | null;

  @Column({ type: DataType.STRING(80), field: 'action', allowNull: false })
  declare action: AuditAction;

  @AllowNull(true)
  @Column({ type: DataType.STRING(80), field: 'resource_type', allowNull: true })
  declare resourceType: string | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(255), field: 'resource_id', allowNull: true })
  declare resourceId: string | null;

  @Column({ type: DataType.STRING(500), field: 'summary', allowNull: false })
  declare summary: string;

  @AllowNull(true)
  @Column({ type: DataType.TEXT, field: 'details', allowNull: true })
  declare details: string | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(64), field: 'ip_address', allowNull: true })
  declare ipAddress: string | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(500), field: 'user_agent', allowNull: true })
  declare userAgent: string | null;

  @Column({ type: DataType.DATE, field: 'created_at', allowNull: false })
  declare createdAt: Date;
}
