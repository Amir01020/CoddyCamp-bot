module.exports = (sequelize, DataTypes) => {
  const MentorUser = sequelize.define(
    'MentorUser',
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
        allowNull: false,
      },
      groupName: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'group_name',
      },
      warehouseHoldings: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'warehouse_holdings',
      },
      coworkingHoldings: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'coworking_holdings',
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
      tableName: 'mentor_users',
      underscored: true,
      timestamps: true,
    }
  );

  return MentorUser;
};
