/**
 * Web shim for Node's `tty` when bundling for browser.
 * Exposes isatty so require('tty').isatty works (returns false in browser).
 */
function isatty() {
  return false;
}
module.exports = {
  isatty,
};
