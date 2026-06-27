module.exports = (sequelize, DataTypes) => {
  const RequestNotification = sequelize.define(
    'RequestNotification',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      requestType: {
        type: DataTypes.ENUM('laptop_request', 'return_request'),
        allowNull: false,
        field: 'request_type',
      },
      requestId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'request_id',
      },
      telegramId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'telegram_id',
      },
      chatId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'chat_id',
      },
      messageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'message_id',
      },
    },
    {
      tableName: 'request_notifications',
      underscored: true,
      timestamps: true,
    }
  );

  return RequestNotification;
};
