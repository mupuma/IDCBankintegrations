// models/Cbbctl.ts
import { CbbctlAttributes, CbbctlCreationAttributes } from '@/app/lib/types';
import { 
  Model, 
  Table, 
  Column, 
  DataType, 
  PrimaryKey 
} from 'sequelize-typescript';



@Table({
  tableName: 'CBBCTL',
  timestamps: false,
  underscored: false
})
export class Cbbctl extends Model<CbbctlAttributes, CbbctlCreationAttributes> {
  @PrimaryKey
    @Column({
        type: DataType.STRING(6),
        field: 'BATCHID',
        allowNull: false
    })
    batchid!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'AUDTDATE',
        allowNull: false,
        defaultValue: 0
    })
    audtdate!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'AUDTTIME',
        allowNull: false,
        defaultValue: 0
    })
    audttime!: number;

  @Column({
        type: DataType.STRING(8),
        field: 'AUDTUSER',
        allowNull: false,
        defaultValue: ''
    })
    audtuser!: string;

  @Column({
        type: DataType.STRING(6),
        field: 'AUDTORG',
        allowNull: false,
        defaultValue: ''
    })
    audtorg!: string;

  @Column({
        type: DataType.STRING(12),
        field: 'BANKCODE',
        allowNull: false,
        defaultValue: ''
    })
    bankcode!: string;

  @Column({
        type: DataType.CHAR(1),
        field: 'ACTIVESW',
        allowNull: true,
        defaultValue: null
    })
    activesw!: string | null;

  @Column({
        type: DataType.STRING(30),
        field: 'TEXTDESC',
        allowNull: false,
        defaultValue: ''
    })
    textdesc!: string;

  @Column({
        type: DataType.STRING(2),
        field: 'SRCELEDGER',
        allowNull: false,
        defaultValue: ''
    })
    srceledger!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATECREATE',
        allowNull: false,
        defaultValue: 0
    })
    datecreate!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEEDITED',
        allowNull: false,
        defaultValue: 0
    })
    dateedited!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'BATCHTYPE',
        allowNull: false,
        defaultValue: 0
    })
    batchtype!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'ENTRYTYPE',
        allowNull: false,
        defaultValue: 0
    })
    entrytype!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'STATUS',
        allowNull: false,
        defaultValue: 0
    })
    status!: number;

  @Column({
        type: DataType.INTEGER,
        field: 'POSTSEQ',
        allowNull: false,
        defaultValue: 0
    })
    postseq!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TOTDEBIT',
        allowNull: false,
        defaultValue: 0
    })
    totdebit!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TOTCREDIT',
        allowNull: false,
        defaultValue: 0
    })
    totcredit!: number;

  @Column({
        type: DataType.INTEGER,
        field: 'CNTENTRY',
        allowNull: false,
        defaultValue: 0
    })
    cntentry!: number;

  @Column({
        type: DataType.INTEGER,
        field: 'NEXTENTRY',
        allowNull: false,
        defaultValue: 0
    })
    nextentry!: number;

  @Column({
        type: DataType.INTEGER,
        field: 'CNTERROR',
        allowNull: false,
        defaultValue: 0
    })
    cnterror!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'BTCHDEC',
        allowNull: false,
        defaultValue: 0
    })
    btchdec!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWPRINTDEP',
        allowNull: false,
        defaultValue: 0
    })
    swprintdep!: number;

  @Column({
        type: DataType.STRING(12),
        field: 'DEPNO',
        allowNull: false,
        defaultValue: ''
    })
    depno!: string;

  @Column({
        type: DataType.STRING(2),
        field: 'DEPPREF',
        allowNull: false,
        defaultValue: ''
    })
    deppref!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWMULTLOCK',
        allowNull: false,
        defaultValue: 0
    })
    swmultlock!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEPOST',
        allowNull: false,
        defaultValue: 0
    })
    datepost!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWTOPOST',
        allowNull: false,
        defaultValue: 0
    })
    swtopost!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'ADJAMOUNT',
        allowNull: false,
        defaultValue: 0
    })
    adjamount!: number;

  @Column({
        type: DataType.STRING(8),
        field: 'USERID',
        allowNull: false,
        defaultValue: ''
    })
    userid!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'SINGLEREF',
        allowNull: false,
        defaultValue: 0
    })
    singleref!: number;

  @Column({
        type: DataType.INTEGER,
        field: 'NOEFTENTRY',
        allowNull: false,
        defaultValue: 0
    })
    noeftentry!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'EFTPRODATE',
        allowNull: false,
        defaultValue: 0
    })
    eftprodate!: number;

  @Column({
        type: DataType.INTEGER,
        field: 'BCKUPSETID',
        allowNull: true,
        defaultValue: null
    })
    bckupsetid!: number;

  @Column({
        type: DataType.STRING(120),
        field: 'EFTEXPFILE',
        allowNull: false,
        defaultValue: ''
    })
    eftexpfile!: string;

  @Column({
        type: DataType.INTEGER,
        field: 'FILESEQNUM',
        allowNull: true,
        defaultValue: null
    })
    fileseqnum!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'EFTRSPOVRD',
        allowNull: true,
        defaultValue: 0
    })
    eftrspovrd!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'EFTPOSTTIM',
        allowNull: false,
        defaultValue: 0
    })
    eftposttim!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWAUTH1',
        allowNull: false,
        defaultValue: 0
    })
    swauth1!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWAUTH2',
        allowNull: false,
        defaultValue: 0
    })
    swauth2!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWAUTH3',
        allowNull: false,
        defaultValue: 0
    })
    swauth3!: number;

  @Column({
        type: DataType.STRING(8),
        field: 'AUTHUSER1',
        allowNull: false,
        defaultValue: ''
    })
    authuser1!: string;

  @Column({
        type: DataType.STRING(8),
        field: 'AUTHUSER2',
        allowNull: false,
        defaultValue: ''
    })
    authuser2!: string;

  @Column({
        type: DataType.STRING(8),
        field: 'AUTHUSER3',
        allowNull: false,
        defaultValue: ''
    })
    authuser3!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'AUTHSTATUS',
        allowNull: false,
        defaultValue: 0
    })
    authstatus!: number;
}