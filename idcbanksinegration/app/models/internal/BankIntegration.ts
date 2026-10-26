import { Model, Table, Column, DataType, PrimaryKey } from 'sequelize-typescript';

@Table({ tableName: 'bank_integrations', timestamps: true, underscored: true })
export class BankIntegration extends Model {
  @PrimaryKey @Column({ type: DataType.STRING(20), allowNull: false }) declare bankCode: string;
  @Column({ type: DataType.STRING(120), allowNull: false }) declare displayName: string;
  @Column({ type: DataType.STRING(32), allowNull: false }) declare adapter: string;
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false }) declare enabled: boolean;
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 }) declare revision: number;
}
