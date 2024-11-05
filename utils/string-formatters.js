/**
 * Returns same string with the first letter converted into its uppercase version.
 * @param {string} str
 * @returns {string}
 */
const capitalize = (str) => {
  return str ? `${str[0].toUpperCase()}${str.slice(1).toLowerCase()}` : '';
};

/**
 * Returns same string with the first letter of each word capitalized.
 * @param {string} str
 * @returns {string}
 */
const titleize = (str) => {
  return str
    .split(' ')
    .map((word) => capitalize(word))
    .join(' ');
};

/**
 * Generate a single string contains a comma separated list of the given string array.
 * @param {string[]} strings
 * @returns {string}
 */
const genCommaSepStrList = (strings) => {
  if (!Array.isArray(strings) || strings.length === 0) return '';
  else if (strings.length === 1) return strings[0];
  else if (strings.length === 2) return strings.join(' & ');
  return strings
    .slice(0, -1)
    .concat(`& ${strings.at(-1)}`)
    .join(', ');
};

module.exports = {
  capitalize,
  titleize,
  genCommaSepStrList,
};
