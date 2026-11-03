import { Model, Table, Column, DataType, PrimaryKey } from 'sequelize-typescript';

// One item per batch during migration. References and the canonical payment are
// immutable; the mutable document is changed only under a database row lock.
@Table({ tableName: 'zicb_h2h_payments', timestamps: true, underscored: true, indexes: [{ fields: ['next_run', 'lease_until'] }] })
export class ZicbH2hPayment extends Model {
  @PrimaryKey @Column(DataType.STRING(36)) declare queueId: string;
  @Column({ type: DataType.STRING(64), allowNull: false, unique: true }) declare paymentKey: string;
  @Column({ type: DataType.STRING(36), allowNull: false, unique: true }) declare reference: string;
  @Column({ type: DataType.STRING(35), allowNull: false, unique: true }) declare prcn: string;
  @Column({ type: DataType.STRING(16), allowNull: false }) declare channel: string;
  @Column({ type: DataType.STRING(32), allowNull: false }) declare state: string;
  @Column({ type: DataType.TEXT('long'), allowNull: false }) declare document: string;
  @Column(DataType.STRING(36)) declare leaseToken: string | null;
  @Column(DataType.DATE) declare leaseUntil: Date | null;
  @Column(DataType.DATE) declare nextRun: Date | null;
}

@Table({ tableName: 'zicb_h2h_events', timestamps: true, underscored: true, updatedAt: false, indexes: [{ fields: ['queue_id'] }] })
export class ZicbH2hEvent extends Model {
  @PrimaryKey @Column(DataType.STRING(64)) declare eventId: string;
  @Column({ type: DataType.STRING(36), allowNull: false }) declare queueId: string;
  @Column({ type: DataType.STRING(32), allowNull: false }) declare kind: string;
  @Column({ type: DataType.TEXT('long'), allowNull: false }) declare payload: string;
}

// Shared by every new portal bank submission, so racing bank selections cannot
// dispatch the same Sage payment through two different integrations.
@Table({ tableName: 'payment_dispatch_reservations', timestamps: true, underscored: true, updatedAt: false })
export class PaymentDispatchReservation extends Model {
  @PrimaryKey @Column(DataType.STRING(64)) declare paymentKey: string;
  @Column({ type: DataType.STRING(100), allowNull: false }) declare queueId: string;
  @Column({ type: DataType.STRING(20), allowNull: false }) declare bankCode: string;
}
