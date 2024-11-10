const AppError = require('../errors/app-generic-error.js');
const populateDB = require('./populate-db.js');
const pool = require('./pool.js');

const MAX_BOOKS_COUNT = Number(process.env.MAX_BOOKS_COUNT) || 50;
const MAX_BOOK_INFO_COUNT = Number(process.env.MAX_BOOK_INFO_COUNT) || 100;

const generateGeneralQuery = (where, limit) => {
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
  ${where || ''}
  GROUP BY books.book_id, languages.language, languages.language_id
  ${limit || ''}
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
   */
  async readBook(id) {
    const query = {
      text: generateGeneralQuery('WHERE books.book_id = $1', 'LIMIT 1'),
      values: [id],
    };
    const [error, result] = await queryDBCatchError(query);
    return error || result.rows[0];
  },

  async readFilteredBooks(filterTable, filterColumn, filterValue) {
    const query = {
      text: generateGeneralQuery(`WHERE ${filterTable}.${filterColumn} = $1`),
      values: [filterValue],
    };
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
