// models/Cboptio.ts
import { 
  Model, 
  Table, 
  Column, 
  DataType, 
  PrimaryKey 
} from 'sequelize-typescript';

// Cboptio attributes interface
interface CboptioAttributes {
  optionid: string;
  audtdate: number;
  audttime: number;
  audtuser: string;
  audtorg: string;
  trnsfrgl: number;
  consoldate: number;
  defbank: string;
  nbtchnum: number;
  npstseqn: number;
  curyear: string;
  glseqn: number;
  glconsoln: number;
  cfbtchcrte: number;
  taxtype: number;
  histdays: number;
  appntobtch: number;
  histtbldys: number;
  frcbtchlst: number;
  autopostap: number;
  autopostar: number;
  swchkdup: number;
  autopostgl: number;
  sweditrtrv: number;
  dftaxgroup: string;
  dfclasstyp: number;
  swwarndate: number;
  apsrcecode: string;
  arsrcecode: string;
  prsrcecode: string;
  swapvoid: number;
  swapalign: number;
  swapsingle: number;
  swapeftbth: number;
  swardposit: number;
  swpostrtar: number;
  swpostrtap: number;
  swpostrtrx: number;
  autopostpm: number;
  apeftpaym: string;
  swapready: number;
  swarready: number;
  swarrefund: number;
  swretrvoe: number;
  swretrvot: number;
  swretrvar: number;
  swretrvap: number;
  swappndeft: number;
  otsrceappl: string;
  lstrtvdate: number;
  recxverno: number;
  eftverno: number;
  sweftlock: number;
}

// Cboptio creation attributes (all fields are required as per @Column(nullable = false))
interface CboptioCreationAttributes extends CboptioAttributes {}

@Table({
  tableName: 'CBOPTIO',
  timestamps: false,
  underscored: false
})
export class Cboptio extends Model<Cboptio, CboptioCreationAttributes> {
  @PrimaryKey
  @Column({
    type: DataType.STRING(4),
    field: 'OPTIONID',
    allowNull: false
  })
  optionid!: string;

  @Column({
    type: DataType.DECIMAL(9, 0),
    field: 'AUDTDATE',
    allowNull: false
  })
  audtdate!: number;

  @Column({
    type: DataType.DECIMAL(9, 0),
    field: 'AUDTTIME',
    allowNull: false
  })
  audttime!: number;

  @Column({
    type: DataType.STRING(8),
    field: 'AUDTUSER',
    allowNull: false
  })
  audtuser!: string;

  @Column({
    type: DataType.STRING(6),
    field: 'AUDTORG',
    allowNull: false
  })
  audtorg!: string;

  @Column({
    type: DataType.SMALLINT,
    field: 'TRNSFRGL',
    allowNull: false
  })
  trnsfrgl!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'CONSOLDATE',
    allowNull: false
  })
  consoldate!: number;

  @Column({
    type: DataType.STRING(12),
    field: 'DEFBANK',
    allowNull: false
  })
  defbank!: string;

  @Column({
    type: DataType.INTEGER,
    field: 'NBTCHNUM',
    allowNull: false
  })
  nbtchnum!: number;

  @Column({
    type: DataType.INTEGER,
    field: 'NPSTSEQN',
    allowNull: false
  })
  npstseqn!: number;

  @Column({
    type: DataType.STRING(4),
    field: 'CURYEAR',
    allowNull: false
  })
  curyear!: string;

  @Column({
    type: DataType.INTEGER,
    field: 'GLSEQN',
    allowNull: false
  })
  glseqn!: number;

  @Column({
    type: DataType.INTEGER,
    field: 'GLCONSOLN',
    allowNull: false
  })
  glconsoln!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'CFBTCHCRTE',
    allowNull: false
  })
  cfbtchcrte!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'TAXTYPE',
    allowNull: false
  })
  taxtype!: number;

  @Column({
    type: DataType.INTEGER,
    field: 'HISTDAYS',
    allowNull: false
  })
  histdays!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'APPNTOBTCH',
    allowNull: false
  })
  appntobtch!: number;

  @Column({
    type: DataType.INTEGER,
    field: 'HISTTBLDYS',
    allowNull: false
  })
  histtbldys!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'FRCBTCHLST',
    allowNull: false
  })
  frcbtchlst!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'AUTOPOSTAP',
    allowNull: false
  })
  autopostap!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'AUTOPOSTAR',
    allowNull: false
  })
  autopostar!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWCHKDUP',
    allowNull: false
  })
  swchkdup!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'AUTOPOSTGL',
    allowNull: false
  })
  autopostgl!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWEDITRTRV',
    allowNull: false
  })
  sweditrtrv!: number;

  @Column({
    type: DataType.STRING(12),
    field: 'DFTAXGROUP',
    allowNull: false
  })
  dftaxgroup!: string;

  @Column({
    type: DataType.SMALLINT,
    field: 'DFCLASSTYP',
    allowNull: false
  })
  dfclasstyp!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWWARNDATE',
    allowNull: false
  })
  swwarndate!: number;

  @Column({
    type: DataType.STRING(4),
    field: 'APSRCECODE',
    allowNull: false
  })
  apsrcecode!: string;

  @Column({
    type: DataType.STRING(4),
    field: 'ARSRCECODE',
    allowNull: false
  })
  arsrcecode!: string;

  @Column({
    type: DataType.STRING(4),
    field: 'PRSRCECODE',
    allowNull: false
  })
  prsrcecode!: string;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWAPVOID',
    allowNull: false
  })
  swapvoid!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWAPALIGN',
    allowNull: false
  })
  swapalign!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWAPSINGLE',
    allowNull: false
  })
  swapsingle!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWAPEFTBTH',
    allowNull: false
  })
  swapeftbth!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWARDPOSIT',
    allowNull: false
  })
  swardposit!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWPOSTRTAR',
    allowNull: false
  })
  swpostrtar!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWPOSTRTAP',
    allowNull: false
  })
  swpostrtap!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWPOSTRTRX',
    allowNull: false
  })
  swpostrtrx!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'AUTOPOSTPM',
    allowNull: false
  })
  autopostpm!: number;

  @Column({
    type: DataType.STRING(12),
    field: 'APEFTPAYM',
    allowNull: false
  })
  apeftpaym!: string;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWAPREADY',
    allowNull: false
  })
  swapready!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWARREADY',
    allowNull: false
  })
  swarready!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWARREFUND',
    allowNull: false
  })
  swarrefund!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWRETRVOE',
    allowNull: false
  })
  swretrvoe!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWRETRVOT',
    allowNull: false
  })
  swretrvot!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWRETRVAR',
    allowNull: false
  })
  swretrvar!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWRETRVAP',
    allowNull: false
  })
  swretrvap!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWAPPNDEFT',
    allowNull: false
  })
  swappndeft!: number;

  @Column({
    type: DataType.STRING(2),
    field: 'OTSRCEAPPL',
    allowNull: false
  })
  otsrceappl!: string;

  @Column({
    type: DataType.DECIMAL(9, 0),
    field: 'LSTRTVDATE',
    allowNull: false
  })
  lstrtvdate!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'RECXVERNO',
    allowNull: false
  })
  recxverno!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'EFTVERNO',
    allowNull: false
  })
  eftverno!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWEFTLOCK',
    allowNull: false
  })
  sweftlock!: number;
}