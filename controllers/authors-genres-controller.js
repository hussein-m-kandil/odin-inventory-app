const db = require('../db/queries.js');
const queryDB = require('../utils/query-db.js');
const { body, validationResult } = require('express-validator');

const MAX_NAME_LEN = 255;
const ALL_ROWS_VIEW = 'authors-genres';
const FORM_VIEW = 'authors-genres-form';

const capitalize = (str) => {
  return str ? `${str[0].toUpperCase()}${str.slice(1).toLowerCase()}` : '';
};

const firstTextFromUrl = (url, singularize = false) => {
  const firstText = url.split('/')[1];
  return singularize ? firstText.slice(0, -1) : firstText;
};

const genCreateFormTitle = (url) => {
  return `Add new ${firstTextFromUrl(url, true)}`;
};

module.exports = {
  getAll: [
    queryDB('dbResult', db.readAllRows, (req) => {
      const column = firstTextFromUrl(req.baseUrl, true);
      const table = `${column}s`;
      return [table, `${column} ASC`]; // The latter for ORDER BY ;)
    }),
    (req, res) => {
      const { dbResult } = res.locals;
      const column = firstTextFromUrl(req.baseUrl, true);
      const data = dbResult.map((entry) => entry[column]);
      const title = capitalize(`${column}s`);
      res.render(ALL_ROWS_VIEW, { title, data });
    },
  ],

  getCreate(req, res) {
    res.render(FORM_VIEW, { title: genCreateFormTitle(req.baseUrl) });
  },

  postCreate: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required!')
      .isLength({ max: MAX_NAME_LEN })
      .withMessage(`Name can't contain more than ${MAX_NAME_LEN} character!`),
    (req, res, next) => {
      res.locals.title = genCreateFormTitle(req.baseUrl);
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return res.render(FORM_VIEW, {
          errors: validationErrors.array(),
          data: req.body,
        });
      }
      next();
    },
    queryDB('dbResult', db.createRow, (req) => {
      // This query method could accept a single value in place of an array
      const column = firstTextFromUrl(req.baseUrl, true);
      const value = req.body.name;
      const table = `${column}s`;
      // `queryDB` spreads an array returned from 'queryArgs' getter function
      return [table, column, value];
    }),
    (req, res) => {
      const { dbResult } = res.locals;
      if (dbResult instanceof Error) {
        const defaultMsg = 'The given name is already exist!';
        const msg = dbResult.detail.split('=')[1] || defaultMsg;
        const errors = [{ path: 'name', msg }];
        return res.render(FORM_VIEW, { data: req.body, errors });
      }
      res.redirect(req.baseUrl);
    },
  ],
};
