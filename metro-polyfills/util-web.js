/**
 * Web shim for Node's `util` when bundling for browser.
 * Exposes TextEncoder/TextDecoder and common util APIs so require('util') works.
 */
const g = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {};
function deprecate(fn, msg) {
  if (typeof fn !== 'function') return fn;
  let warned = false;
  return function (...args) {
    if (!warned && typeof console !== 'undefined' && console.warn) {
      warned = true;
      console.warn('DeprecationWarning: ' + msg);
    }
    return fn.apply(this, args);
  };
}
module.exports = {
  TextEncoder: g.TextEncoder || (function () { throw new Error('TextEncoder is not available'); }),
  TextDecoder: g.TextDecoder || (function () { throw new Error('TextDecoder is not available'); }),
  inspect: (v) => (typeof v === 'object' && v !== null ? JSON.stringify(v, null, 2) : String(v)),
  format: (...args) => args.map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join(' '),
  deprecate,
  types: {
    isArray: Array.isArray,
    isRegExp: (v) => Object.prototype.toString.call(v) === '[object RegExp]',
    isDate: (v) => Object.prototype.toString.call(v) === '[object Date]',
    isNativeError: (v) => v instanceof Error,
  },
};
