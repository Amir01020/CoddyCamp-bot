module.exports = (sequelize, DataTypes) => {
  const Laptop = sequelize.define(
    'Laptop',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      number: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
    },
    {
      tableName: 'laptops',
      underscored: true,
      timestamps: true,
    }
  );

  return Laptop;
};
