const { STEPS } = require('../constants');

module.exports = {
  STEPS,
  clearState: require('../session').clearState,
  registerAdminHandlers: () => {},
};
