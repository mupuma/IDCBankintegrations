import { Model, Table, Column, DataType, PrimaryKey } from 'sequelize-typescript';

@Table({ tableName: 'payment_recovery_actions', timestamps: true, underscored: true })
export class PaymentRecoveryAction extends Model {
  @PrimaryKey @Column(DataType.STRING(36)) declare actionId: string;
  @Column({ type: DataType.STRING(100), allowNull: false }) declare queueId: string;
  @Column({ type: DataType.STRING(100), unique: true }) declare activeQueueId: string | null;
  @Column({ type: DataType.STRING(20), allowNull: false }) declare bankCode: string;
  @Column({ type: DataType.STRING(32), allowNull: false }) declare action: string;
  @Column({ type: DataType.STRING(20), allowNull: false }) declare status: string;
  @Column({ type: DataType.STRING(100), allowNull: false }) declare requestedBy: string;
  @Column({ type: DataType.TEXT, allowNull: false }) declare reason: string;
  @Column({ type: DataType.TEXT('long'), allowNull: false }) declare request: string;
  @Column(DataType.TEXT('long')) declare result: string | null;
  @Column(DataType.STRING(36)) declare leaseToken: string | null;
  @Column(DataType.DATE) declare leaseUntil: Date | null;
}
