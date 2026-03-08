/**
 * Web shim for Node's `async_hooks` when bundling for browser.
 * Exports a minimal AsyncLocalStorage so require('async_hooks').AsyncLocalStorage is a constructor.
 */
class AsyncLocalStorage {
  constructor() {
    this._store = undefined;
  }
  run(store, callback, ...args) {
    const prev = this._store;
    this._store = store;
    try {
      return callback(...args);
    } finally {
      this._store = prev;
    }
  }
  getStore() {
    return this._store;
  }
  enterWith(store) {
    this._store = store;
  }
  exit(callback, ...args) {
    return callback(...args);
  }
}

module.exports = {
  AsyncLocalStorage,
};
