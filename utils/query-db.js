/**
 * Returns an express middleware that maps the query result to `resultName` into `res.locals`.
 * Accepts any number of arguments to be given to `queryMethod` while executing the middleware.
 * Those arguments could be any value to be given as is, except the `function` value
 * will be executed in a scope that can consume `req, res, next` middleware arguments.
 * The result of this `function` argument will be given to `queryMethod` as is,
 * unless the result is an `array`, its values will be given instead.
 * @param {string} resultName
 * @param {function} queryMethod
 * @param  {...any} queryArgs
 * @returns {(req, res, next) => any}
 */
const queryDB = (resultName, queryMethod, ...queryArgs) => {
  return (req, res, next) => {
    const netQueryArgs = [];
    queryArgs.forEach((arg) => {
      if (typeof arg !== 'function') {
        netQueryArgs.push(arg);
      } else {
        const argResult = arg(req, res, next);
        if (Array.isArray(argResult)) netQueryArgs.push(...argResult);
        else netQueryArgs.push(argResult);
      }
    });
    queryMethod(...netQueryArgs)
      .then((result) => {
        res.locals[resultName] = result;
        next();
      })
      .catch(next);
  };
};

module.exports = queryDB;
