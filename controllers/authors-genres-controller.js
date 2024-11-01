const db = require('../db/queries.js');
const queryDB = require('../utils/query-db.js');
const AppGenericError = require('../errors/app-generic-error.js');
const { body, param, validationResult } = require('express-validator');

const MAX_NAME_LEN = 255;
const ALL_ROWS_VIEW = 'authors-genres';
const FORM_VIEW = 'authors-genres-form';
const DELETE_FORM_VIEW = 'delete-form';

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

const genEditFormTitle = (url) => {
  return `Edit ${firstTextFromUrl(url, true)}`;
};

const genDeleteFormTitle = (url) => {
  return `Delete ${firstTextFromUrl(url, true)}`;
};

const idValidators = [
  param('id').isInt(),
  (req, res, next) => {
    return validationResult(req).isEmpty() ? next() : next('route');
  },
];

const getReadOrDelByIdArgs = (req, res) => {
  const entityName = firstTextFromUrl(req.baseUrl, true);
  const table = `${entityName}s`;
  const { id } = req.params;
  res.locals.entityName = entityName;
  return [table, `${entityName}_id`, id];
};

const readRawByIdFromDB = queryDB(
  'dbResult',
  db.readRowByWhereClause,
  getReadOrDelByIdArgs
);

const checkDBResult = (req, res, next) => {
  if (!res.locals.dbResult) {
    throw new AppGenericError('Bad Request!', 400);
  }
  next();
};

const nameFieldValidators = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required!')
    .isLength({ max: MAX_NAME_LEN })
    .withMessage(`Name can't contain more than ${MAX_NAME_LEN} character!`),
  (req, res, next) => {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.render(FORM_VIEW, {
        errors: validationErrors.array(),
        data: req.body,
      });
    }
    next();
  },
];

const redirectOrShowError = (errorView, getDataOnError) => {
  return (req, res) => {
    const { dbResult } = res.locals;
    if (dbResult instanceof AppGenericError) {
      const errors = [{ path: 'name', msg: dbResult.message }];
      return res
        .status(dbResult.statusCode)
        .render(errorView, { errors, ...getDataOnError(req, res) });
    }
    res.redirect(req.baseUrl);
  };
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
      // const data = dbResult.map((entry) => entry[column]);
      const title = capitalize(`${column}s`);
      res.render(ALL_ROWS_VIEW, { title, data: dbResult });
    },
  ],

  getCreate(req, res) {
    res.render(FORM_VIEW, { title: genCreateFormTitle(req.baseUrl) });
  },

  postCreate: [
    (req, res, next) => {
      res.locals.title = genCreateFormTitle(req.baseUrl);
      next();
    },
    ...nameFieldValidators,
    queryDB('dbResult', db.createRow, (req) => {
      // This query method could accept a single value in place of an array
      const column = firstTextFromUrl(req.baseUrl, true);
      const value = req.body.name;
      const table = `${column}s`;
      // `queryDB` spreads an array returned from 'queryArgs' getter function
      return [table, column, value];
    }),
    redirectOrShowError(FORM_VIEW, (req) => ({ data: req.body })),
  ],

  getEdit: [
    ...idValidators,
    readRawByIdFromDB,
    checkDBResult,
    (req, res) => {
      const title = genEditFormTitle(req.baseUrl);
      const data = { name: res.locals.dbResult[res.locals.entityName] };
      res.render(FORM_VIEW, { title, data });
    },
  ],

  postEdit: [
    (req, res, next) => {
      res.locals.title = genEditFormTitle(req.baseUrl);
      next();
    },
    ...idValidators,
    ...nameFieldValidators,
    queryDB('dbResult', db.updateRowsByWhereClause, (req, res) => {
      const firstThreeArgs = getReadOrDelByIdArgs(req, res);
      const entityName = firstThreeArgs[1].replace(/_id$/, '');
      return firstThreeArgs.concat(entityName, req.body.name);
    }),
    redirectOrShowError(FORM_VIEW, (req) => ({ data: req.body })),
  ],

  getDelete: [
    ...idValidators,
    readRawByIdFromDB,
    checkDBResult,
    (req, res) => {
      const title = genDeleteFormTitle(req.baseUrl);
      const item = res.locals.dbResult[res.locals.entityName];
      res.render(DELETE_FORM_VIEW, { title, item });
    },
  ],

  postDelete: [
    (req, res, next) => {
      res.locals.title = genDeleteFormTitle(req.baseUrl);
      next();
    },
    ...idValidators,
    queryDB('dbResult', db.deleteRowsByWhereClause, getReadOrDelByIdArgs),
    checkDBResult,
    redirectOrShowError(DELETE_FORM_VIEW, (req) => {
      return { item: firstTextFromUrl(req.baseUrl, true) };
    }),
  ],
};
