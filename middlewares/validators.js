const { param, validationResult } = require('express-validator');

module.exports = {
  idValidators: [
    param('id').isInt(),
    (req, res, next) => {
      return validationResult(req).isEmpty() ? next() : next('route');
    },
  ],
};
