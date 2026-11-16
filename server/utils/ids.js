/**
 * The largest value of a PostgreSQL INTEGER (int4) column. Every id and every integer column the
 * API filters on is an INTEGER, so a larger number cannot match a row: PostgreSQL does not answer
 * "no such row" for it, it fails with "value out of range" (22003). Validators check this limit
 * first, so such a request is a 400 that never reaches the database.
 */
const MAX_INT4 = 2147483647;

/** Whether the value is a positive integer that fits an INTEGER column (a valid row id). */
function isInt4Id(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_INT4;
}

module.exports = { MAX_INT4, isInt4Id };
