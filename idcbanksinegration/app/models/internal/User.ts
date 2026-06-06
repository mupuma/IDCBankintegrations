// models/User.ts with password hashing
import { 
  Model, 
  Table, 
  Column, 
  DataType, 
  PrimaryKey,
  AutoIncrement,
  Unique,
  BeforeCreate,
  BeforeUpdate
} from 'sequelize-typescript';
import * as bcrypt from 'bcrypt';

interface UserAttributes {
  id: number;
  username: string;
  password: string;
  role: string;
  isActive: boolean;
}

interface UserCreationAttributes extends Omit<UserAttributes, 'id' | 'isActive'> {
  id?: number;
  isActive?: boolean;
}

@Table({
  tableName: 'users',
  timestamps: false,
  underscored: true
})
export class User extends Model<User, UserCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column({
    type: DataType.BIGINT,
    field: 'id',
    allowNull: false,
    autoIncrement: true
  })
  declare id: number;

  @Unique
  @Column({
    type: DataType.STRING(255),
    field: 'username',
    allowNull: false,
    unique: true
  })
  declare username: string;

  @Column({
    type: DataType.STRING(255),
    field: 'password',
    allowNull: false
  })
  declare password: string;

  @Column({
    type: DataType.STRING(50),
    field: 'role',
    allowNull: false,
    defaultValue: 'OPERATOR',
  })
  declare role: string;

  @Column({
    type: DataType.BOOLEAN,
    field: 'is_active',
    allowNull: false,
    defaultValue: true,
  })
  declare isActive: boolean;

  // Hash password before creating
  @BeforeCreate
  static async hashPasswordOnCreate(instance: User) {
    if (instance.password) {
      const salt = await bcrypt.genSalt(10);
      instance.password = await bcrypt.hash(instance.password, salt);
    }
  }

  // Hash password before updating (only if password changed)
  @BeforeUpdate
  static async hashPasswordOnUpdate(instance: User) {
    if (instance.changed('password')) {
      const salt = await bcrypt.genSalt(10);
      instance.password = await bcrypt.hash(instance.password, salt);
    }
  }

  // Instance method to validate password
  async validatePassword(password: string): Promise<boolean> {
    if (!password || !this.password) {
      return false;
    }
    return bcrypt.compare(password, this.password);
  }
}