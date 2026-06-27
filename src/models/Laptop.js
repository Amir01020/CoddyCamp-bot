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
      inCoworking: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'in_coworking',
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
