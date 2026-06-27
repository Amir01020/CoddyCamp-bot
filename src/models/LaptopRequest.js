module.exports = (sequelize, DataTypes) => {
  const LaptopRequest = sequelize.define(
    'LaptopRequest',
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
      groupName: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'group_name',
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'accepted', 'fulfilled', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      acceptedBy: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'accepted_by',
      },
      acceptedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'accepted_at',
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
      fulfilledAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'fulfilled_at',
      },
    },
    {
      tableName: 'laptop_requests',
      underscored: true,
      timestamps: true,
    }
  );

  return LaptopRequest;
};
