import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'login_smtp_settings', timestamps: false })
export class LoginSmtpSettings extends Model {
  @PrimaryKey @Column(DataType.BIGINT)
  declare id: number;

  @Column(DataType.TEXT)
  declare configuration: string;

  @Column(DataType.BOOLEAN)
  declare enabled: boolean;
}

@Table({ tableName: 'login_otp_challenges', timestamps: false, underscored: true })
export class LoginOtpChallenge extends Model {
  @PrimaryKey @Column(DataType.BIGINT)
  declare userId: number;

  @Column(DataType.STRING(36))
  declare challengeId: string;

  @Column(DataType.STRING(64))
  declare digest: string;

  @Column(DataType.DATE)
  declare issuedAt: Date;

  @Column(DataType.INTEGER)
  declare attempts: number;
}
