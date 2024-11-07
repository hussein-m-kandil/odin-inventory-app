const { body, param, validationResult } = require('express-validator');
const { removeHyphens } = require('../utils/string-formatters');

const BOOK_TITLE_MAX = 255;
const ISBN_MAX = 13;
const ISBN_MIN = 9;

module.exports = {
  idValidators: [
    param('id').isInt(),
    (req, res, next) => {
      return validationResult(req).isEmpty() ? next() : next('route');
    },
  ],

  bookValidators: [
    body('book')
      .trim()
      .isLength({ min: 1, max: BOOK_TITLE_MAX })
      .withMessage(
        `A book title is required & can only contain ${BOOK_TITLE_MAX} characters at most!`
      ),
    body('isbn')
      .trim()
      .customSanitizer(removeHyphens)
      .isLength({ min: ISBN_MIN, max: ISBN_MAX })
      .withMessage(
        `ISBN is required & must contain from ${ISBN_MIN} to ${ISBN_MAX} numbers, whether hyphen-separated or not!`
      )
      .isNumeric()
      .withMessage(
        'ISBN can contain numbers only, optionally separated with hyphens!'
      ),
    body('language_id')
      .trim()
      .isInt()
      .withMessage('A book must have a language!'),
    body('pages')
      .trim()
      .isInt({ max: Number.MAX_SAFE_INTEGER })
      .withMessage(
        `The number of pages is required & must be a whole number less than ${Number.MAX_SAFE_INTEGER}!`
      ),
    body('price')
      .trim()
      .isNumeric()
      .withMessage('A price must be a number!')
      .customSanitizer((price) => Number.parseFloat(price).toFixed(2)),
    body('stock_count')
      .trim()
      .isInt({ max: Number.MAX_SAFE_INTEGER })
      .withMessage(
        `A stock count is required & must be a whole number less than ${Number.MAX_SAFE_INTEGER}`
      ),
    body('authors')
      .trim()
      .notEmpty()
      .withMessage('You must choose at least one author!'),
    body('genres')
      .trim()
      .notEmpty()
      .withMessage('You must choose at least one genre!'),
  ],
};
