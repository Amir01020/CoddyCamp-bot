module.exports = (sequelize, DataTypes) => {
  const SupportUser = sequelize.define(
    'SupportUser',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      telegramId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true,
        field: 'telegram_id',
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
      createdBy: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'created_by',
      },
    },
    {
      tableName: 'support_users',
      underscored: true,
      timestamps: true,
    }
  );

  return SupportUser;
};
