// models/Arcus.ts
import { ArcusAttributes, ArcusCreationAttributes } from '@/app/lib/types';
import { Optional } from 'sequelize';
import { 
  Model, 
  Table, 
  Column, 
  DataType, 
  PrimaryKey 
} from 'sequelize-typescript';



@Table({
  tableName: 'ARCUS',
  timestamps: false,
  underscored: false
})
export class Arcus extends Model<ArcusAttributes, ArcusCreationAttributes> {
  @PrimaryKey
    @Column({
        type: DataType.STRING(12),
        field: 'IDCUST',
        allowNull: false
    })
    idcust!: string;

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
        type: DataType.STRING(10),
        field: 'TEXTSNAM',
        allowNull: false,
        defaultValue: ''
    })
    textsnam!: string;

  @Column({
        type: DataType.STRING(6),
        field: 'IDGRP',
        allowNull: false,
        defaultValue: ''
    })
    idgrp!: string;

  @Column({
        type: DataType.STRING(12),
        field: 'IDNATACCT',
        allowNull: false,
        defaultValue: ''
    })
    idnatacct!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWACTV',
        allowNull: false,
        defaultValue: 0
    })
    swactv!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEINAC',
        allowNull: false,
        defaultValue: 0
    })
    dateinac!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTMN',
        allowNull: false,
        defaultValue: 0
    })
    datelastmn!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWHOLD',
        allowNull: false,
        defaultValue: 0
    })
    swhold!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATESTART',
        allowNull: false,
        defaultValue: 0
    })
    datestart!: number;

  @Column({
        type: DataType.STRING(12),
        field: 'IDPPNT',
        allowNull: false,
        defaultValue: ''
    })
    idppnt!: string;

  @Column({
        type: DataType.STRING(9),
        field: 'CODEDAB',
        allowNull: false,
        defaultValue: ''
    })
    codedab!: string;

  @Column({
        type: DataType.STRING(5),
        field: 'CODEDABRTG',
        allowNull: false,
        defaultValue: ''
    })
    codedabrtg!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEDAB',
        allowNull: false,
        defaultValue: 0
    })
    datedab!: number;

  @Column({
        type: DataType.STRING(60),
        field: 'NAMECUST',
        allowNull: false,
        defaultValue: ''
    })
    namecust!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TEXTSTRE1',
        allowNull: false,
        defaultValue: ''
    })
    textstre1!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TEXTSTRE2',
        allowNull: false,
        defaultValue: ''
    })
    textstre2!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TEXTSTRE3',
        allowNull: false,
        defaultValue: ''
    })
    textstre3!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TEXTSTRE4',
        allowNull: false,
        defaultValue: ''
    })
    textstre4!: string;

  @Column({
        type: DataType.STRING(30),
        field: 'NAMECITY',
        allowNull: false,
        defaultValue: ''
    })
    namecity!: string;

  @Column({
        type: DataType.STRING(30),
        field: 'CODESTTE',
        allowNull: false,
        defaultValue: ''
    })
    codestte!: string;

  @Column({
        type: DataType.STRING(20),
        field: 'CODEPSTL',
        allowNull: false,
        defaultValue: ''
    })
    codepstl!: string;

  @Column({
        type: DataType.STRING(30),
        field: 'CODECTRY',
        allowNull: false,
        defaultValue: ''
    })
    codectry!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'NAMECTAC',
        allowNull: false,
        defaultValue: ''
    })
    namectac!: string;

  @Column({
        type: DataType.STRING(30),
        field: 'TEXTPHON1',
        allowNull: false,
        defaultValue: ''
    })
    textphon1!: string;

  @Column({
        type: DataType.STRING(30),
        field: 'TEXTPHON2',
        allowNull: false,
        defaultValue: ''
    })
    textphon2!: string;

  @Column({
        type: DataType.STRING(6),
        field: 'CODETERR',
        allowNull: false,
        defaultValue: ''
    })
    codeterr!: string;

  @Column({
        type: DataType.STRING(6),
        field: 'IDACCTSET',
        allowNull: false,
        defaultValue: ''
    })
    idacctset!: string;

  @Column({
        type: DataType.STRING(6),
        field: 'IDAUTOCASH',
        allowNull: false,
        defaultValue: ''
    })
    idautocash!: string;

  @Column({
        type: DataType.STRING(6),
        field: 'IDBILLCYCL',
        allowNull: false,
        defaultValue: ''
    })
    idbillcycl!: string;

  @Column({
        type: DataType.STRING(6),
        field: 'IDSVCCHRG',
        allowNull: false,
        defaultValue: ''
    })
    idsvcchrg!: string;

  @Column({
        type: DataType.STRING(6),
        field: 'IDDLNQ',
        allowNull: false,
        defaultValue: ''
    })
    iddlnq!: string;

  @Column({
        type: DataType.STRING(3),
        field: 'CODECURN',
        allowNull: false,
        defaultValue: ''
    })
    codecurn!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWPRTSTMT',
        allowNull: false,
        defaultValue: 0
    })
    swprtstmt!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWPRTDLNQ',
        allowNull: false,
        defaultValue: 0
    })
    swprtdlnq!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWBALFWD',
        allowNull: false,
        defaultValue: 0
    })
    swbalfwd!: number;

  @Column({
        type: DataType.STRING(6),
        field: 'CODETERM',
        allowNull: false,
        defaultValue: ''
    })
    codeterm!: string;

  @Column({
        type: DataType.STRING(2),
        field: 'IDRATETYPE',
        allowNull: false,
        defaultValue: ''
    })
    idratetype!: string;

  @Column({
        type: DataType.STRING(12),
        field: 'CODETAXGRP',
        allowNull: false,
        defaultValue: ''
    })
    codetaxgrp!: string;

  @Column({
        type: DataType.STRING(20),
        field: 'IDTAXREGI1',
        allowNull: false,
        defaultValue: ''
    })
    idtaxregi1!: string;

  @Column({
        type: DataType.STRING(20),
        field: 'IDTAXREGI2',
        allowNull: false,
        defaultValue: ''
    })
    idtaxregi2!: string;

  @Column({
        type: DataType.STRING(20),
        field: 'IDTAXREGI3',
        allowNull: false,
        defaultValue: ''
    })
    idtaxregi3!: string;

  @Column({
        type: DataType.STRING(20),
        field: 'IDTAXREGI4',
        allowNull: false,
        defaultValue: ''
    })
    idtaxregi4!: string;

  @Column({
        type: DataType.STRING(20),
        field: 'IDTAXREGI5',
        allowNull: false,
        defaultValue: ''
    })
    idtaxregi5!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXSTTS1',
        allowNull: false,
        defaultValue: 0
    })
    taxstts1!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXSTTS2',
        allowNull: false,
        defaultValue: 0
    })
    taxstts2!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXSTTS3',
        allowNull: false,
        defaultValue: 0
    })
    taxstts3!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXSTTS4',
        allowNull: false,
        defaultValue: 0
    })
    taxstts4!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXSTTS5',
        allowNull: false,
        defaultValue: 0
    })
    taxstts5!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTCRLIMT',
        allowNull: false,
        defaultValue: 0
    })
    amtcrlimt!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBALDUET',
        allowNull: false,
        defaultValue: 0
    })
    amtbalduet!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBALDUEH',
        allowNull: false,
        defaultValue: 0
    })
    amtbaldueh!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTST',
        allowNull: false,
        defaultValue: 0
    })
    datelastst!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTSTT',
        allowNull: false,
        defaultValue: 0
    })
    amtlaststt!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTSTH',
        allowNull: false,
        defaultValue: 0
    })
    amtlaststh!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DTBEGBALFW',
        allowNull: false,
        defaultValue: 0
    })
    dtbegbalfw!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBALFWDT',
        allowNull: false,
        defaultValue: 0
    })
    amtbalfwdt!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBALFWDH',
        allowNull: false,
        defaultValue: 0
    })
    amtbalfwdh!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DTLASTRVAL',
        allowNull: false,
        defaultValue: 0
    })
    dtlastrval!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBALLARV',
        allowNull: false,
        defaultValue: 0
    })
    amtballarv!: number;

  @Column({
        type: DataType.DECIMAL(7, 0),
        field: 'CNTOPENINV',
        allowNull: false,
        defaultValue: 0
    })
    cntopeninv!: number;

  @Column({
        type: DataType.DECIMAL(7, 0),
        field: 'CNTINVPAID',
        allowNull: false,
        defaultValue: 0
    })
    cntinvpaid!: number;

  @Column({
        type: DataType.DECIMAL(7, 0),
        field: 'DAYSTOPAY',
        allowNull: false,
        defaultValue: 0
    })
    daystopay!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEINVCHI',
        allowNull: false,
        defaultValue: 0
    })
    dateinvchi!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEBALHI',
        allowNull: false,
        defaultValue: 0
    })
    datebalhi!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEINVHIL',
        allowNull: false,
        defaultValue: 0
    })
    dateinvhil!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEBALHIL',
        allowNull: false,
        defaultValue: 0
    })
    datebalhil!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTAC',
        allowNull: false,
        defaultValue: 0
    })
    datelastac!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTIV',
        allowNull: false,
        defaultValue: 0
    })
    datelastiv!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTCR',
        allowNull: false,
        defaultValue: 0
    })
    datelastcr!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTDR',
        allowNull: false,
        defaultValue: 0
    })
    datelastdr!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTPA',
        allowNull: false,
        defaultValue: 0
    })
    datelastpa!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTDI',
        allowNull: false,
        defaultValue: 0
    })
    datelastdi!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTAD',
        allowNull: false,
        defaultValue: 0
    })
    datelastad!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTWR',
        allowNull: false,
        defaultValue: 0
    })
    datelastwr!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTRI',
        allowNull: false,
        defaultValue: 0
    })
    datelastri!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTIN',
        allowNull: false,
        defaultValue: 0
    })
    datelastin!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTDQ',
        allowNull: false,
        defaultValue: 0
    })
    datelastdq!: number;

  @Column({
        type: DataType.STRING(22),
        field: 'IDINVCHI',
        allowNull: false,
        defaultValue: ''
    })
    idinvchi!: string;

  @Column({
        type: DataType.STRING(22),
        field: 'IDINVCHILY',
        allowNull: false,
        defaultValue: ''
    })
    idinvchily!: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTINVHIT',
        allowNull: false,
        defaultValue: 0
    })
    amtinvhit!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBALHIT',
        allowNull: false,
        defaultValue: 0
    })
    amtbalhit!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTINVHILT',
        allowNull: false,
        defaultValue: 0
    })
    amtinvhilt!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBALHILT',
        allowNull: false,
        defaultValue: 0
    })
    amtbalhilt!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTIVT',
        allowNull: false,
        defaultValue: 0
    })
    amtlastivt!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTCRT',
        allowNull: false,
        defaultValue: 0
    })
    amtlastcrt!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTDRT',
        allowNull: false,
        defaultValue: 0
    })
    amtlastdrt!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTPYT',
        allowNull: false,
        defaultValue: 0
    })
    amtlastpyt!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTDIT',
        allowNull: false,
        defaultValue: 0
    })
    amtlastdit!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTADT',
        allowNull: false,
        defaultValue: 0
    })
    amtlastadt!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTWRT',
        allowNull: false,
        defaultValue: 0
    })
    amtlastwrt!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTRIT',
        allowNull: false,
        defaultValue: 0
    })
    amtlastrit!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTINT',
        allowNull: false,
        defaultValue: 0
    })
    amtlastint!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTINVHIH',
        allowNull: false,
        defaultValue: 0
    })
    amtinvhih!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBALHIH',
        allowNull: false,
        defaultValue: 0
    })
    amtbalhih!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTINVHILH',
        allowNull: false,
        defaultValue: 0
    })
    amtinvhilh!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBALHILH',
        allowNull: false,
        defaultValue: 0
    })
    amtbalhilh!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTIVH',
        allowNull: false,
        defaultValue: 0
    })
    amtlastivh!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTCRH',
        allowNull: false,
        defaultValue: 0
    })
    amtlastcrh!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTDRH',
        allowNull: false,
        defaultValue: 0
    })
    amtlastdrh!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTPYH',
        allowNull: false,
        defaultValue: 0
    })
    amtlastpyh!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTDIH',
        allowNull: false,
        defaultValue: 0
    })
    amtlastdih!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTADH',
        allowNull: false,
        defaultValue: 0
    })
    amtlastadh!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTWRH',
        allowNull: false,
        defaultValue: 0
    })
    amtlastwrh!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTRIH',
        allowNull: false,
        defaultValue: 0
    })
    amtlastrih!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTINH',
        allowNull: false,
        defaultValue: 0
    })
    amtlastinh!: number;

  @Column({
        type: DataType.STRING(8),
        field: 'CODESLSP1',
        allowNull: false,
        defaultValue: ''
    })
    codeslsp1!: string;

  @Column({
        type: DataType.STRING(8),
        field: 'CODESLSP2',
        allowNull: false,
        defaultValue: ''
    })
    codeslsp2!: string;

  @Column({
        type: DataType.STRING(8),
        field: 'CODESLSP3',
        allowNull: false,
        defaultValue: ''
    })
    codeslsp3!: string;

  @Column({
        type: DataType.STRING(8),
        field: 'CODESLSP4',
        allowNull: false,
        defaultValue: ''
    })
    codeslsp4!: string;

  @Column({
        type: DataType.STRING(8),
        field: 'CODESLSP5',
        allowNull: false,
        defaultValue: ''
    })
    codeslsp5!: string;

  @Column({
        type: DataType.DECIMAL(9, 5),
        field: 'PCTSASPLT1',
        allowNull: false,
        defaultValue: 0
    })
    pctsasplt1!: number;

  @Column({
        type: DataType.DECIMAL(9, 5),
        field: 'PCTSASPLT2',
        allowNull: false,
        defaultValue: 0
    })
    pctsasplt2!: number;

  @Column({
        type: DataType.DECIMAL(9, 5),
        field: 'PCTSASPLT3',
        allowNull: false,
        defaultValue: 0
    })
    pctsasplt3!: number;

  @Column({
        type: DataType.DECIMAL(9, 5),
        field: 'PCTSASPLT4',
        allowNull: false,
        defaultValue: 0
    })
    pctsasplt4!: number;

  @Column({
        type: DataType.DECIMAL(9, 5),
        field: 'PCTSASPLT5',
        allowNull: false,
        defaultValue: 0
    })
    pctsasplt5!: number;

  @Column({
        type: DataType.STRING(6),
        field: 'PRICLIST',
        allowNull: false,
        defaultValue: ''
    })
    priclist!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'CUSTTYPE',
        allowNull: false,
        defaultValue: 0
    })
    custtype!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTPDUE',
        allowNull: false,
        defaultValue: 0
    })
    amtpdue!: number;

  @Column({
        type: DataType.STRING(50),
        field: 'EMAIL1',
        allowNull: false,
        defaultValue: ''
    })
    email1!: string;

  @Column({
        type: DataType.STRING(50),
        field: 'EMAIL2',
        allowNull: false,
        defaultValue: ''
    })
    email2!: string;

  @Column({
        type: DataType.STRING(100),
        field: 'WEBSITE',
        allowNull: false,
        defaultValue: ''
    })
    website!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'BILLMETHOD',
        allowNull: false,
        defaultValue: 0
    })
    billmethod!: number;

  @Column({
        type: DataType.STRING(12),
        field: 'PAYMCODE',
        allowNull: false,
        defaultValue: ''
    })
    paymcode!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'FOB',
        allowNull: false,
        defaultValue: ''
    })
    fob!: string;

  @Column({
        type: DataType.STRING(6),
        field: 'SHPVIACODE',
        allowNull: false,
        defaultValue: ''
    })
    shpviacode!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'SHPVIADESC',
        allowNull: false,
        defaultValue: ''
    })
    shpviadesc!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'DELMETHOD',
        allowNull: false,
        defaultValue: 0
    })
    delmethod!: number;

  @Column({
        type: DataType.STRING(6),
        field: 'PRIMSHIPTO',
        allowNull: false,
        defaultValue: ''
    })
    primshipto!: string;

  @Column({
        type: DataType.STRING(30),
        field: 'CTACPHONE',
        allowNull: false,
        defaultValue: ''
    })
    ctacphone!: string;

  @Column({
        type: DataType.STRING(30),
        field: 'CTACFAX',
        allowNull: false,
        defaultValue: ''
    })
    ctacfax!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWPARTSHIP',
        allowNull: false,
        defaultValue: 0
    })
    swpartship!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWWEBSHOP',
        allowNull: false,
        defaultValue: 0
    })
    swwebshop!: number;

  @Column({
        type: DataType.DECIMAL(9, 5),
        field: 'RTGPERCENT',
        allowNull: false,
        defaultValue: 0
    })
    rtgpercent!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'RTGDAYS',
        allowNull: false,
        defaultValue: 0
    })
    rtgdays!: number;

  @Column({
        type: DataType.STRING(6),
        field: 'RTGTERMS',
        allowNull: false,
        defaultValue: ''
    })
    rtgterms!: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RTGAMTTC',
        allowNull: false,
        defaultValue: 0
    })
    rtgamttc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RTGAMTHC',
        allowNull: false,
        defaultValue: 0
    })
    rtgamthc!: number;

  @Column({
        type: DataType.INTEGER,
        field: 'VALUES',
        allowNull: true,
        defaultValue: null
    })
    values!: number;

  @Column({
        type: DataType.DECIMAL(7, 0),
        field: 'CNTPPDINVC',
        allowNull: false,
        defaultValue: 0
    })
    cntppdinvc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTPPDINVT',
        allowNull: false,
        defaultValue: 0
    })
    amtppdinvt!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTPPDINVH',
        allowNull: false,
        defaultValue: 0
    })
    amtppdinvh!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTRF',
        allowNull: false,
        defaultValue: 0
    })
    datelastrf!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTRFT',
        allowNull: false,
        defaultValue: 0
    })
    amtlastrft!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTRFH',
        allowNull: false,
        defaultValue: 0
    })
    amtlastrfh!: number;

  @Column({
        type: DataType.STRING(3),
        field: 'CODECHECK',
        allowNull: false,
        defaultValue: ''
    })
    codecheck!: string;

  @Column({
        type: DataType.INTEGER,
        field: 'NEXTCUID',
        allowNull: true,
        defaultValue: null
    })
    nextcuid!: number;

  @Column({
        type: DataType.STRING(6),
        field: 'LOCATION',
        allowNull: false,
        defaultValue: ''
    })
    location!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWCHKLIMIT',
        allowNull: true,
        defaultValue: 0
    })
    swchklimit!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWCHKOVER',
        allowNull: true,
        defaultValue: 0
    })
    swchkover!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'OVERDAYS',
        allowNull: true,
        defaultValue: 0
    })
    overdays!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'OVERAMT',
        allowNull: false,
        defaultValue: 0
    })
    overamt!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWBACKORDR',
        allowNull: true,
        defaultValue: 0
    })
    swbackordr!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWCHKDUPPO',
        allowNull: true,
        defaultValue: 0
    })
    swchkduppo!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'CATEGORY',
        allowNull: true,
        defaultValue: 0
    })
    category!: number;

  @Column({
        type: DataType.STRING(30),
        field: 'BRN',
        allowNull: false,
        defaultValue: ''
    })
    brn!: string;
}