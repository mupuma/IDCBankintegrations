import { Model, Table, Column, DataType, PrimaryKey } from 'sequelize-typescript';

/** Portal MySQL only. Credentials and configuration are encrypted before persistence. */
@Table({ tableName: 'bank_agent_profiles', timestamps: true, underscored: true })
export class BankAgentProfile extends Model {
  @PrimaryKey @Column({ type: DataType.STRING(20), allowNull: false }) declare bankCode: string;
  @Column({ type: DataType.STRING(2048), allowNull: false }) declare agentUrl: string;
  @Column({ type: DataType.TEXT('long'), allowNull: false }) declare manifestJson: string;
  @Column({ type: DataType.TEXT('long'), allowNull: false }) declare encryptedToken: string;
  @Column({ type: DataType.TEXT('long'), allowNull: true }) declare encryptedConfiguration: string | null;
  @Column({ type: DataType.INTEGER, allowNull: false }) declare revision: number;
}
