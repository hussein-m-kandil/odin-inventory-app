const AppError = require('../errors/app-generic-error.js');
const populateDB = require('./populate-db.js');
const pool = require('./pool.js');

const MAX_BOOKS_COUNT = Number(process.env.MAX_BOOKS_COUNT) || 50;
const MAX_BOOK_INFO_COUNT = Number(process.env.MAX_BOOK_INFO_COUNT) || 100;

const generateGeneralQuery = (where = '', orderBy = '', limit = '') => {
  return `
    SELECT books.book_id,
            book,
            isbn,
            languages.language,
            languages.language_id,
            json_object_agg(DISTINCT authors.author_id, authors.author) AS authors,
            json_object_agg(DISTINCT genres.genre_id, genres.genre) AS genres,
            pages,
            price,
            stock_count,
            created_at,
            updated_at
      FROM books
      JOIN languages
        ON books.language_id = languages.language_id
      JOIN books_authors
        ON books.book_id = books_authors.book_id
      JOIN authors
        ON books_authors.author_id = authors.author_id
      JOIN books_genres
        ON books.book_id = books_genres.book_id
      JOIN genres
        ON books_genres.genre_id = genres.genre_id
  ${typeof where === 'string' ? where : ''}
  GROUP BY books.book_id, languages.language, languages.language_id
  ${typeof orderBy === 'string' ? orderBy : ''}
  ${typeof limit === 'string' ? limit : ''}
`;
};

const tryCatchLogPromise = async (fn) => {
  try {
    await fn();
  } catch (e) {
    console.log(e);
  }
};

const queryDBCatchError = async (query) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await client.query(query);
    await client.query('COMMIT');
    return [null, result];
  } catch (error) {
    console.log(error);
    if (error.code === '23505') {
      // So, it is an unique_violation error
      const message =
        error.detail.split('=')[1] ||
        'The given value is already exist while it must be unique!';
      return [new AppError(message, 409)];
    } else if (error.code === '23503') {
      // So, it is an foreign_key_violation error
      const message = 'It cannot be deleted because it is in use by a book!';
      return [new AppError(message, 409)];
    }
    if (client) {
      await tryCatchLogPromise(async () => await client.query('ROLLBACK'));
    }
    throw new AppError('Oops, something went wrong! Try again later.', 500);
  } finally {
    if (client) await tryCatchLogPromise(() => client.release());
  }
};

const isNotReachMaxTableSize = async (table) => {
  const maxCount = table === 'books' ? MAX_BOOKS_COUNT : MAX_BOOK_INFO_COUNT;
  const result = await queryDBCatchError(`SELECT * FROM ${table}`);
  if (result[1].rowCount >= maxCount) {
    throw new AppError('The database is full, delete some entries!', 409);
  }
  return true;
};

module.exports = {
  /**
   * @param {number | string} id
   * @param {boolean?} booksOnly - If true, selects from 'books' table only—no join
   */
  async readBook(id, booksOnly = false) {
    const whereClause = 'WHERE books.book_id = $1';
    const limitClause = 'LIMIT 1';
    const text = booksOnly
      ? `SELECT * FROM books ${whereClause} ${limitClause}`
      : generateGeneralQuery(whereClause, null, limitClause);
    const query = { text, values: [id] };
    const [error, result] = await queryDBCatchError(query);
    return error || result.rows[0];
  },

  /**
   * Return a list of books filtered with a SQL clauses prepared from the given arguments.
   * The full SQL filtration clauses, if all arguments in place, could be in the following form: `
   *   SELECT ... WHERE scopeT1.scopeC1 = scopeV1
   *      AND ...
   *      AND filterT1.filterC1 ILIKE '%filterV1%'
   *       OR ...
   * ORDER BY orderby1, ...
   *    LIMIT limit
   * `
   *
   * @param {string[]?} scopeTableDotColArr - ['table.column', ...]
   * @param {any[]?} scopeValues - Values for scope columns to strict the filtration result
   * @param {string[]?} filterTableDotColArr - ['table.column', ...]
   * @param {any[]?} filterValues - Values for filter columns to do case insensitive search with
   * @param {string[]?} orderByTableDotColArr - ['column', 'column', ...]
   * @param {boolean?} descOrder - If true, a descending ordered rows will be returned
   * @param {number?} limit - A number that will be used as the limit of rows in the query
   * @param {boolean?} booksOnly - If true, selects from 'books' table only—no join
   */
  async readFilteredBooks(
    scopeTableDotColArr,
    scopeValues,
    filterTableDotColArr,
    filterValues,
    orderByTableDotColArr,
    descOrder = false,
    limit = null,
    booksOnly = false
  ) {
    let values;
    let paramsCount = 0;
    let whereClause = '';
    let orderByClause = '';
    let limitClause = '';
    if (Array.isArray(scopeTableDotColArr)) {
      whereClause += 'WHERE ';
      whereClause += scopeTableDotColArr
        .map((tableDotCol) => `${tableDotCol} = $${++paramsCount}`)
        .join(' AND ');
      values = [...scopeValues];
    }
    if (filterValues) {
      if (!whereClause) whereClause += 'WHERE ';
      else whereClause += ' AND ';
      whereClause += filterTableDotColArr
        .map((tableDotCol) => `${tableDotCol} ILIKE $${++paramsCount}`)
        .join(' OR ');
      if (Array.isArray(values)) {
        values.push(...filterValues.map((fv) => `%${fv}%`));
      } else {
        values = filterValues.map((fv) => `%${fv}%`);
      }
    }
    if (Array.isArray(orderByTableDotColArr)) {
      orderByClause += 'ORDER BY ';
      orderByClause += orderByTableDotColArr.join(', ');
      orderByClause += descOrder ? ' DESC' : '';
    }
    if (limit) {
      limitClause = `LIMIT $${++paramsCount}`;
      if (Array.isArray(values)) values.push(limit);
      else values = [limit];
    }
    const text = booksOnly
      ? `SELECT * FROM books ${whereClause} ${orderByClause} ${limitClause}`
      : generateGeneralQuery(whereClause, orderByClause, limitClause);
    const query = { text, values };
    const [error, result] = await queryDBCatchError(query);
    return error || result.rows;
  },

  async readLastAddedBook() {
    const query = {
      text: 'SELECT * FROM books ORDER BY created_at DESC LIMIT 1',
    };
    const [error, result] = await queryDBCatchError(query);
    return error || result;
  },

  async readAllBooks() {
    const query = { text: generateGeneralQuery() };
    // Try to read all books, if no books try to populate the db, then repeat... 5 times
    for (let i = 0; i < 5; i++) {
      const [error, result] = await queryDBCatchError(query);
      if (error) return error;
      else if (result.rows.length > 0) return result.rows;
      else {
        try {
          await populateDB();
        } catch (error) {
          console.log(error);
          break;
        }
      }
    }
    return [];
  },

  /**
   * @param {string} table
   * @param {string | string[] | null} columns
   * @param {any | any[] | null} values
   */
  async createRow(table, columns, values) {
    if (await isNotReachMaxTableSize(table)) {
      const preparedCols = Array.isArray(columns) ? columns : [columns];
      const preparedValues = Array.isArray(values) ? values : [values];
      const params = preparedValues.map((_, i) => `$${i + 1}`);
      const query = {
        text: `
        INSERT INTO ${table} (${preparedCols.join(',')})
              VALUES (${params.join(',')})
        `,
        values: [...preparedValues],
      };
      const [error, result] = await queryDBCatchError(query);
      return error || result;
    }
  },

  /**
   * orderBy example: `'col' || 'col DESC' || ['col1', 'col2'] || ['col1 ASC', 'col2 DESC']`
   *
   * @param {string} table
   * @param {string | string[] | null} orderBy
   * @param {boolean?} desc
   */
  async readAllRows(table, orderBy) {
    let orderByStr;
    if (orderBy) {
      orderByStr = ' ORDER BY ';
      orderByStr += Array.isArray(orderBy) ? orderBy.join(', ') : orderBy;
    }
    const query = { text: `SELECT * FROM ${table}${orderByStr || ''}` };
    const [error, result] = await queryDBCatchError(query);
    return error || result.rows;
  },

  /**
   * @param {string} table
   * @param {string} clauseKey
   * @param {number | string} clauseValue
   */
  async readRowByWhereClause(table, clauseKey, clauseValue) {
    const query = {
      text: `SELECT * FROM ${table} WHERE ${clauseKey} = $1`,
      values: [clauseValue],
    };
    const [error, result] = await queryDBCatchError(query);
    return error || result.rows[0];
  },

  /**
   * @param {string} table
   * @param {string} clauseKey
   * @param {number | string} clauseValue
   * @param {string | string[]} columns
   * @param {string | string[]} values
   */
  async updateRowsByWhereClause(
    table,
    clauseKey,
    clauseValue,
    columns,
    values
  ) {
    let paramCount = 1;
    const columnParamStrPairs = [];
    if (Array.isArray(columns)) {
      columns.forEach((c) => {
        columnParamStrPairs.push(`${c} = $${paramCount++}`);
      });
    } else {
      columnParamStrPairs.push(`${columns} = $${paramCount++}`);
    }
    const query = {
      text: `
         UPDATE ${table}
            SET ${columnParamStrPairs.join(', ')}
          WHERE ${clauseKey} = $${paramCount}
      `,
      values: Array.isArray(values)
        ? values.concat(clauseValue)
        : [values, clauseValue],
    };
    const [error, result] = await queryDBCatchError(query);
    return error || result;
  },

  /**
   * @param {string} table
   * @param {string} clauseKey
   * @param {number | string} clauseValue
   */
  async deleteRowsByWhereClause(table, clauseKey, clauseValue) {
    const query = {
      text: `DELETE FROM ${table} WHERE ${clauseKey} = $1`,
      values: [clauseValue],
    };
    const [error, result] = await queryDBCatchError(query);
    return error || result;
  },
};
