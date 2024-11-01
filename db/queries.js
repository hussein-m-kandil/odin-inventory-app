const AppError = require('../errors/app-generic-error.js');
const pool = require('./pool.js');

const createGeneralQuery = (where, limit) => {
  return `
    SELECT books.book_id,
            book,
            isbn,
            language,
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
  GROUP BY books.book_id, language
  ${limit || ''}
`;
};

const queryDBCatchError = async (query) => {
  try {
    return [null, await pool.query(query)];
  } catch (error) {
    console.log(error);
    if (error.code === '23505') {
      // So, it is an unique_violation error
      const message =
        error.detail.split('=')[1] ||
        'The given value is already exist while it must be unique!';
      return [new AppError(message, 400)];
    } else if (error.code === '23503') {
      // So, it is an foreign_key_violation error
      const message = 'It cannot be deleted because it is in use by a book!';
      return [new AppError(message, 400)];
    }
    throw new AppError('Mission failed! Try again later.', 500);
  }
};

module.exports = {
  /**
   * @param {number | string} id
   */
  async readBook(id) {
    const query = {
      text: createGeneralQuery('WHERE books.book_id = $1', 'LIMIT 1'),
      values: [id],
    };
    const [error, result] = await queryDBCatchError(query);
    return error || result.rows[0];
  },

  async readAllBooks() {
    const query = {
      text: createGeneralQuery(),
    };
    const [error, result] = await queryDBCatchError(query);
    return error || result.rows;
  },

  /**
   * @param {string} table
   * @param {string | string[] | null} columns
   * @param {any | any[] | null} values
   */
  async createRow(table, columns, values) {
    const preparedColumns = Array.isArray(columns)
      ? columns.join(',')
      : columns;
    const preparedValues = Array.isArray(values) ? values.join(',') : values;
    const query = {
      text: `INSERT INTO ${table} (${preparedColumns}) VALUES ($1)`,
      values: [preparedValues],
    };
    const [error, result] = await queryDBCatchError(query);
    return error || result;
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
