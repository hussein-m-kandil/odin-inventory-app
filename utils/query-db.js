module.exports = {
  /**
   * Query the db and return a pair of values.
   * If error thrown, will be handled by rendering the given view
   * with a predefined message and status 500 and the error will be return as the first value,
   * Otherwise, the result will be return as the second value and the first value will be null.
   *
   * @param {any} res - Express.js response object
   * @param {string} view - View file to render with db error & status 500
   * @param {function} queryMethod - A method to call from db queries object 'db/queries.js'
   * @param  {...any} queryArgs - Any number of argument to be given to the db query method
   * @returns {[null, any] | [Error]}
   */
  async queryDB(res, view, queryMethod, ...queryArgs) {
    try {
      return [null, await queryMethod(...queryArgs)];
    } catch (error) {
      console.log(error);
      res.status(500).render(view, {
        error: 'Could not get any data, try again later!',
      });
      return [error];
    }
  },
};
