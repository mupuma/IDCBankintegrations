// models/Apven.ts
import { ApvenAttributes, ApvenCreationAttributes } from '@/app/lib/types';
import { Optional } from 'sequelize';
import { 
  Model, 
  Table, 
  Column, 
  DataType, 
  PrimaryKey 
} from 'sequelize-typescript';



@Table({
  tableName: 'APVEN',
  timestamps: false,
  underscored: false
})
export class Apven extends Model<ApvenAttributes, ApvenCreationAttributes> {
  @PrimaryKey
    @Column({
        type: DataType.STRING(12),
        field: 'VENDORID',
        allowNull: false
    })
    declare vendorid: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'AUDTDATE',
        allowNull: false,
        defaultValue: 0
    })
   declare audtdate: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'AUDTTIME',
        allowNull: false,
        defaultValue: 0
    })
    declare audttime: number;

  @Column({
        type: DataType.STRING(8),
        field: 'AUDTUSER',
        allowNull: false,
        defaultValue: ''
    })
    declare audtuser: string;

  @Column({
        type: DataType.STRING(6),
        field: 'AUDTORG',
        allowNull: false,
        defaultValue: ''
    })
    declare audtorg: string;

  @Column({
        type: DataType.STRING(10),
        field: 'SHORTNAME',
        allowNull: false,
        defaultValue: ''
    })
    declare shortname: string;

  @Column({
        type: DataType.STRING(6),
        field: 'IDGRP',
        allowNull: false,
        defaultValue: ''
    })
    declare idgrp: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWACTV',
        allowNull: false,
        defaultValue: 0
    })
    declare swactv: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEINAC',
        allowNull: false,
        defaultValue: 0
    })
    declare dateinac: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTMN',
        allowNull: false,
        defaultValue: 0
    })
    declare datelastmn: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWHOLD',
        allowNull: false,
        defaultValue: 0
    })
    declare swhold: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATESTART',
        allowNull: false,
        defaultValue: 0
    })
    declare datestart: number;

  @Column({
        type: DataType.STRING(12),
        field: 'IDPPNT',
        allowNull: false,
        defaultValue: ''
    })
    declare idppnt: string;

  @Column({
        type: DataType.STRING(60),
        field: 'VENDNAME',
        allowNull: false,
        defaultValue: ''
    })
    declare vendname: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TEXTSTRE1',
        allowNull: false,
        defaultValue: ''
    })
    declare textstre1: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TEXTSTRE2',
        allowNull: false,
        defaultValue: ''
    })
    declare textstre2: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TEXTSTRE3',
        allowNull: false,
        defaultValue: ''
    })
    declare textstre3: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TEXTSTRE4',
        allowNull: false,
        defaultValue: ''
    })
    declare textstre4: string;

  @Column({
        type: DataType.STRING(30),
        field: 'NAMECITY',
        allowNull: false,
        defaultValue: ''
    })
    declare namecity: string;

  @Column({
        type: DataType.STRING(30),
        field: 'CODESTTE',
        allowNull: false,
        defaultValue: ''
    })
    declare codestte: string;

  @Column({
        type: DataType.STRING(20),
        field: 'CODEPSTL',
        allowNull: false,
        defaultValue: ''
    })
   declare codepstl: string;

  @Column({
        type: DataType.STRING(30),
        field: 'CODECTRY',
        allowNull: false,
        defaultValue: ''
    })
   declare codectry: string;

  @Column({
        type: DataType.STRING(60),
        field: 'NAMECTAC',
        allowNull: false,
        defaultValue: ''
    })
   declare namectac: string;

  @Column({
        type: DataType.STRING(30),
        field: 'TEXTPHON1',
        allowNull: false,
        defaultValue: ''
    })
   declare textphon1: string;

  @Column({
        type: DataType.STRING(30),
        field: 'TEXTPHON2',
        allowNull: false,
        defaultValue: ''
    })
    textphon2!: string;

  @Column({
        type: DataType.STRING(6),
        field: 'PRIMRMIT',
        allowNull: false,
        defaultValue: ''
    })
    declare primrmit: string;

  @Column({
        type: DataType.STRING(6),
        field: 'IDACCTSET',
        allowNull: false,
        defaultValue: ''
    })
    declare idacctset: string;

  @Column({
        type: DataType.STRING(3),
        field: 'CURNCODE',
        allowNull: false,
        defaultValue: ''
    })
    declare curncode: string;

  @Column({
        type: DataType.STRING(2),
        field: 'RATETYPE',
        allowNull: false,
        defaultValue: ''
    })
    declare ratetype: string;

  @Column({
        type: DataType.STRING(8),
        field: 'BANKID',
        allowNull: false,
        defaultValue: ''
    })
    declare bankid: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'PRTSEPCHKS',
        allowNull: false,
        defaultValue: 0
    })
    declare prtsepchks: number;

  @Column({
        type: DataType.STRING(6),
        field: 'DISTSETID',
        allowNull: false,
        defaultValue: ''
    })
    declare distsetid: string;

  @Column({
        type: DataType.STRING(6),
        field: 'DISTCODE',
        allowNull: false,
        defaultValue: ''
    })
    declare distcode: string;

  @Column({
        type: DataType.STRING(45),
        field: 'GLACCNT',
        allowNull: false,
        defaultValue: ''
    })
    declare glaccnt: string;

  @Column({
        type: DataType.STRING(6),
        field: 'TERMSCODE',
        allowNull: false,
        defaultValue: ''
    })
    declare termscode: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'DUPINVCCD',
        allowNull: false,
        defaultValue: 0
    })
    declare dupinvccd: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'DUPAMTCODE',
        allowNull: false,
        defaultValue: 0
    })
    declare dupamtcode: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'DUPDATECD',
        allowNull: false,
        defaultValue: 0
    })
    declare dupdatecd: number;

  @Column({
        type: DataType.STRING(12),
        field: 'CODETAXGRP',
        allowNull: false,
        defaultValue: ''
    })
    declare codetaxgrp: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXCLASS1',
        allowNull: false,
        defaultValue: 0
    })
    declare taxclass1: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXCLASS2',
        allowNull: false,
        defaultValue: 0
    })
    declare taxclass2: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXCLASS3',
        allowNull: false,
        defaultValue: 0
    })
    declare taxclass3: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXCLASS4',
        allowNull: false,
        defaultValue: 0
    })
    declare taxclass4: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXCLASS5',
        allowNull: false,
        defaultValue: 0
    })
    declare taxclass5: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXRPTSW',
        allowNull: false,
        defaultValue: 0
    })
    declare taxrptsw: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SUBJTOWTHH',
        allowNull: false,
        defaultValue: 0
    })
    declare subjtowthh: number;

  @Column({
        type: DataType.STRING(20),
        field: 'TAXNBR',
        allowNull: false,
        defaultValue: ''
    })
    declare taxnbr: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXIDTYPE',
        allowNull: false,
        defaultValue: 0
    })
    declare taxidtype: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXNOTE2SW',
        allowNull: false,
        defaultValue: 0
    })
    declare taxnote2sw: number;

  @Column({
        type: DataType.STRING(6),
        field: 'CLASID',
        allowNull: false,
        defaultValue: ''
    })
    declare clasid: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTCRLIMT',
        allowNull: false,
        defaultValue: 0
    })
    declare amtcrlimt: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBALDUET',
        allowNull: false,
        defaultValue: 0
    })
    declare amtbalduet: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBALDUEH',
        allowNull: false,
        defaultValue: 0
    })
    declare amtbaldueh: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTPPDINVT',
        allowNull: false,
        defaultValue: 0
    })
    declare amtppdinvt: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTPPDINVH',
        allowNull: false,
        defaultValue: 0
    })
    declare amtppdinvh: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DTLASTRVAL',
        allowNull: false,
        defaultValue: 0
    })
    declare dtlastrval: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBALLARV',
        allowNull: false,
        defaultValue: 0
    })
    declare amtballarv: number;

  @Column({
        type: DataType.DECIMAL(7, 0),
        field: 'CNTOPENINV',
        allowNull: false,
        defaultValue: 0
    })
    declare cntopeninv: number;

  @Column({
        type: DataType.DECIMAL(7, 0),
        field: 'CNTPPDINVC',
        allowNull: false,
        defaultValue: 0
    })
    declare cntppdinvc: number;

  @Column({
        type: DataType.DECIMAL(7, 0),
        field: 'CNTINVPAID',
        allowNull: false,
        defaultValue: 0
    })
    declare cntinvpaid: number;

  @Column({
        type: DataType.DECIMAL(7, 0),
        field: 'DAYSTOPAY',
        allowNull: false,
        defaultValue: 0
    })
    declare daystopay: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEINVCHI',
        allowNull: false,
        defaultValue: 0
    })
    declare dateinvchi: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEBALHI',
        allowNull: false,
        defaultValue: 0
    })
    declare datebalhi: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEINVHIL',
        allowNull: false,
        defaultValue: 0
    })
    declare dateinvhil: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEBALHIL',
        allowNull: false,
        defaultValue: 0
    })
    declare datebalhil: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTAC',
        allowNull: false,
        defaultValue: 0
    })
    declare datelastac: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTIV',
        allowNull: false,
        defaultValue: 0
    })
    declare datelastiv: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTCR',
        allowNull: false,
        defaultValue: 0
    })
    declare datelastcr: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTDR',
        allowNull: false,
        defaultValue: 0
    })
    declare datelastdr: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTPA',
        allowNull: false,
        defaultValue: 0
    })
    declare datelastpa: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELASTDI',
        allowNull: false,
        defaultValue: 0
    })
    declare datelastdi: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELSTADJ',
        allowNull: false,
        defaultValue: 0
    })
    declare datelstadj: number;

  @Column({
        type: DataType.STRING(22),
        field: 'IDINVCHI',
        allowNull: false,
        defaultValue: ''
    })
    declare idinvchi: string;

  @Column({
        type: DataType.STRING(22),
        field: 'IDINVCHILY',
        allowNull: false,
        defaultValue: ''
    })
    declare idinvchily: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTINVHIT',
        allowNull: false,
        defaultValue: 0
    })
    declare amtinvhit: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBALHIT',
        allowNull: false,
        defaultValue: 0
    })
    declare amtbalhit: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTWTHTCUR',
        allowNull: false,
        defaultValue: 0
    })
    declare amtwthtcur: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTINVHILT',
        allowNull: false,
        defaultValue: 0
    })
    declare amtinvhilt: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBALHILT',
        allowNull: false,
        defaultValue: 0
    })
    declare amtbalhilt: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTWTHLYTC',
        allowNull: false,
        defaultValue: 0
    })
    declare amtwthlytc: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTIVT',
        allowNull: false,
        defaultValue: 0
    })
    declare amtlastivt: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTCRT',
        allowNull: false,
        defaultValue: 0
    })
    declare amtlastcrt: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTDRT',
        allowNull: false,
        defaultValue: 0
    })
    declare amtlastdrt: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTPYT',
        allowNull: false,
        defaultValue: 0
    })
    declare amtlastpyt: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTDIT',
        allowNull: false,
        defaultValue: 0
    })
    declare amtlastdit: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTADT',
        allowNull: false,
        defaultValue: 0
    })
    declare amtlastadt: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTINVHIH',
        allowNull: false,
        defaultValue: 0
    })
    declare amtinvhih: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBALHIH',
        allowNull: false,
        defaultValue: 0
    })
    declare amtbalhih: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTWTHHCUR',
        allowNull: false,
        defaultValue: 0
    })
    declare amtwthhcur: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTINVHILH',
        allowNull: false,
        defaultValue: 0
    })
    declare amtinvhilh: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBALHILH',
        allowNull: false,
        defaultValue: 0
    })
    declare amtbalhilh: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTWTHLYHC',
        allowNull: false,
        defaultValue: 0
    })
    declare amtwthlyhc: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTIVH',
        allowNull: false,
        defaultValue: 0
    })
    declare amtlastivh: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTCRH',
        allowNull: false,
        defaultValue: 0
    })
    declare amtlastcrh: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTDRH',
        allowNull: false,
        defaultValue: 0
    })
    declare amtlastdrh: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTPYH',
        allowNull: false,
        defaultValue: 0
    })
    declare amtlastpyh: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTDIH',
        allowNull: false,
        defaultValue: 0
    })
    declare amtlastdih: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTLASTADH',
        allowNull: false,
        defaultValue: 0
    })
    declare amtlastadh: number;

  @Column({
        type: DataType.STRING(12),
        field: 'PAYMCODE',
        allowNull: false,
        defaultValue: ''
    })
    declare paymcode: string;

  @Column({
        type: DataType.STRING(20),
        field: 'IDTAXREGI1',
        allowNull: false,
        defaultValue: ''
    })
    declare idtaxregi1: string;

  @Column({
        type: DataType.STRING(20),
        field: 'IDTAXREGI2',
        allowNull: false,
        defaultValue: ''
    })
    declare idtaxregi2: string;

  @Column({
        type: DataType.STRING(20),
        field: 'IDTAXREGI3',
        allowNull: false,
        defaultValue: ''
    })
    declare idtaxregi3: string;

  @Column({
        type: DataType.STRING(20),
        field: 'IDTAXREGI4',
        allowNull: false,
        defaultValue: ''
    })
    declare idtaxregi4: string;

  @Column({
        type: DataType.STRING(20),
        field: 'IDTAXREGI5',
        allowNull: false,
        defaultValue: ''
    })
    declare idtaxregi5: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWDISTBY',
        allowNull: false,
        defaultValue: 0
    })
    declare swdistby: number;

  @Column({
        type: DataType.STRING(3),
        field: 'CODECHECK',
        allowNull: false,
        defaultValue: ''
    })
    declare codecheck: string;

  @Column({
        type: DataType.DECIMAL(9, 1),
        field: 'AVGDAYSPAY',
        allowNull: false,
        defaultValue: 0
    })
    declare avgdayspay: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AVGPAYMENT',
        allowNull: false,
        defaultValue: 0
    })
    declare avgpayment: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTINVPDHC',
        allowNull: false,
        defaultValue: 0
    })
    declare amtinvpdhc: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTINVPDTC',
        allowNull: false,
        defaultValue: 0
    })
    declare amtinvpdtc: number;

  @Column({
        type: DataType.DECIMAL(7, 0),
        field: 'CNTNBRCHKS',
        allowNull: false,
        defaultValue: 0
    })
    declare cntnbrchks: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWTXINC1',
        allowNull: false,
        defaultValue: 0
    })
    declare swtxinc1  : number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWTXINC2',
        allowNull: false,
        defaultValue: 0
    })
    declare swtxinc2 : number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWTXINC3',
        allowNull: false,
        defaultValue: 0
    })
   declare swtxinc3: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWTXINC4',
        allowNull: false,
        defaultValue: 0
    })
    declare swtxinc4: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWTXINC5',
        allowNull: false,
        defaultValue: 0
    })
    declare swtxinc5: number;

  @Column({
        type: DataType.STRING(50),
        field: 'EMAIL1',
        allowNull: false,
        defaultValue: ''
    })
    declare email1: string;

  @Column({
        type: DataType.STRING(50),
        field: 'EMAIL2',
        allowNull: false,
        defaultValue: ''
    })
    declare email2: string;

  @Column({
        type: DataType.STRING(100),
        field: 'WEBSITE',
        allowNull: false,
        defaultValue: ''
    })
    declare website: string;

  @Column({
        type: DataType.STRING(30),
        field: 'CTACPHONE',
        allowNull: false,
        defaultValue: ''
    })
    declare ctacphone: string;

  @Column({
        type: DataType.STRING(30),
        field: 'CTACFAX',
        allowNull: false,
        defaultValue: ''
    })
    declare ctacfax: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'DELMETHOD',
        allowNull: false,
        defaultValue: 0
    })
    declare delmethod: number;

  @Column({
        type: DataType.DECIMAL(9, 5),
        field: 'RTGPERCENT',
        allowNull: false,
        defaultValue: 0
    })
    declare rtgpercent: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'RTGDAYS',
        allowNull: false,
        defaultValue: 0
    })
    declare rtgdays: number;

  @Column({
        type: DataType.STRING(6),
        field: 'RTGTERMS',
        allowNull: false,
        defaultValue: ''
    })
    declare rtgterms: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RTGAMTTC',
        allowNull: false,
        defaultValue: 0
    })
    declare rtgamttc: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RTGAMTHC',
        allowNull: false,
        defaultValue: 0
    })
    declare rtgamthc: number;

  @Column({
        type: DataType.INTEGER,
        field: 'VALUES',
        allowNull: true,
        defaultValue: null
    })
    declare values: number;

  @Column({
        type: DataType.INTEGER,
        field: 'NEXTCUID',
        allowNull: true,
        defaultValue: null
    })
    declare nextcuid: number;

  @Column({
        type: DataType.STRING(60),
        field: 'LEGALNAME',
        allowNull: false,
        defaultValue: ''
    })
    declare legalname: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'CHK1099AMT',
        allowNull: true,
        defaultValue: 0
    })
    declare chk1099amt  : number;

  @Column({
        type: DataType.STRING(12),
        field: 'IDCUST',
        allowNull: false,
        defaultValue: ''
    })
    declare idcust: string;

  @Column({
        type: DataType.STRING(30),
        field: 'BRN',
        allowNull: false,
        defaultValue: ''
    })
    declare brn: string;

  @Column({
        type: DataType.STRING(15),
        field: 'FIRSTNAME',
        allowNull: false,
        defaultValue: ''
    })
    declare firstname: string;

  @Column({
        type: DataType.STRING(25),
        field: 'LASTNAME',
        allowNull: false,
        defaultValue: ''
    })
    declare lastname: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'FATCA',
        allowNull: true,
        defaultValue: 0
    })
    declare fatca: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SECONDTIN',
        allowNull: true,
        defaultValue: 0
    })
    declare secondtin: number;

  @Column({
        type: DataType.STRING(2),
        field: 'TAXWHSTTE',
        allowNull: false,
        defaultValue: ''
    })
    declare taxwhstte: string;
}