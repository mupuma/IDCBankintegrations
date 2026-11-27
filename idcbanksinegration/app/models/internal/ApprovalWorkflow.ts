import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'approval_workflows', underscored: true })
export class ApprovalWorkflow extends Model {
  @PrimaryKey @Column(DataType.STRING(140))
  declare scope: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare definition: string;
}
