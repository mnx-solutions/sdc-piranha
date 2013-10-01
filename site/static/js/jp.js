'use strict';

var JP = {
    _modules: {},
    _includes: [],
    _globals: {},
    getModule: function (name) {
        return this._modules[name];
    },
    createModule: function (name, register, configFn) {
        if (this._modules[name]) {
            throw new TypeError('Module already defined');
        }
        register = register || [];
        this._modules[name] = window.angular.module(name, register, configFn);
        this._includes.push(name);
        return this._modules[name];
    },
    setMain: function (name, register, configFn) {
        if (window.angular.isArray(register)) {
            this._includes = register;
        }

        this.main = window.angular.module(name, this._includes, configFn);
    },
    set: function (name, val) {
      this._globals[name] = val;
    },
    get: function (name) {
      return this._globals[name];
    }
};