module.exports = (sequelize, DataTypes) => {
  const ReturnRequest = sequelize.define(
    'ReturnRequest',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      mentorTelegramId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'mentor_telegram_id',
      },
      mentorName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'mentor_name',
      },
      supportTelegramId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'support_telegram_id',
      },
      warehouseQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'warehouse_quantity',
      },
      coworkingQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'coworking_quantity',
      },
      coworkingLaptopIds: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        field: 'coworking_laptop_ids',
      },
      status: {
        type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      respondedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'responded_at',
      },
    },
    {
      tableName: 'return_requests',
      underscored: true,
      timestamps: true,
    }
  );

  return ReturnRequest;
};
