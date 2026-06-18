module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define(
    'Transaction',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      studentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'student_id',
      },
      laptopId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'laptop_id',
      },
      issuedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'issued_at',
      },
      returnedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'returned_at',
      },
      issuedBy: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'issued_by',
      },
      returnedBy: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'returned_by',
      },
    },
    {
      tableName: 'transactions',
      underscored: true,
      timestamps: true,
    }
  );

  return Transaction;
};
