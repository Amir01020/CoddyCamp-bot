module.exports = (sequelize, DataTypes) => {
  const Student = sequelize.define(
    'Student',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
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
    },
    {
      tableName: 'students',
      underscored: true,
      timestamps: true,
    }
  );

  return Student;
};
