// eslint-disable-next-line import/no-extraneous-dependencies
const EnvironmentNode = require('jest-environment-node');

class WithFixedErrorEnvironmentNode extends EnvironmentNode {
  constructor(config) {
    super(config);
    this.global.Error = Error;
  }
}

module.exports = WithFixedErrorEnvironmentNode;
