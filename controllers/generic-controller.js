const db = require('../db/queries.js');
const queryDB = require('../utils/query-db.js');
const AppGenericError = require('../errors/app-generic-error.js');
const { idValidators } = require('../middlewares/validators.js');
const { body, validationResult } = require('express-validator');
const {
  capitalize,
  titleize,
  genCommaSepStrList,
} = require('../utils/string-formatters.js');

const BOOKS_VIEW = 'index';
const ALL_ROWS_VIEW = 'generic-list';
const FORM_VIEW = 'generic-form';
const DELETE_FORM_VIEW = 'delete-form';

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

const getReadOrDelByIdArgs = (req, res) => {
  res.locals.entityName = firstTextFromUrl(req.baseUrl, true);
  const table = `${res.locals.entityName}s`;
  const { id } = req.params;
  return [table, `${res.locals.entityName}_id`, id];
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
    .custom((value, { req }) => {
      const maxLen = firstTextFromUrl(req.baseUrl) === 'languages' ? 127 : 255;
      if (value.length > maxLen) {
        throw new AppGenericError(
          `Name can't contain more than ${maxLen} character!`
        );
      }
      return true;
    }),
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

  getBooks: [
    ...idValidators,
    readRawByIdFromDB,
    queryDB('books', db.readFilteredBooks, (req, res) => {
      Object.entries(req.query).forEach(([k, v]) => (res.locals[k] = v));
      res.locals.entityName = firstTextFromUrl(req.baseUrl, true);
      return [
        [`${res.locals.entityName}s.${res.locals.entityName}_id`],
        [req.params.id],
        req.query.q ? ['books.book', 'books.isbn'] : null,
        req.query.q ? [req.query.q, req.query.q] : null,
        req.query.orderby ? [`books.${req.query.orderby}`] : null,
        Boolean(req.query.desc_order),
        null,
      ];
    }),
    (req, res) => {
      const { entityName, dbResult, books } = res.locals;
      res.locals.title = titleize(`${dbResult[entityName]} Books`);
      books.forEach((b) => {
        b.authors = genCommaSepStrList(Object.values(b.authors));
        b.genres = genCommaSepStrList(Object.values(b.genres));
      });
      res.render(BOOKS_VIEW);
    },
  ],
};
