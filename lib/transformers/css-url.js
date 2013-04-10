'use strict';

var path = require('path');


module.exports = function (route) {
    function isAbsoluteUrl(str) {
        if(str.indexOf('http://') === 0 || str.indexOf('https://') === 0) {
            return true;
        }
        return false;
    }

    function getCorrectUrl(url) {
        url = url.replace(/"/g,'').replace(/'/g,'');
        if (url.indexOf('//') === 0) {
            return '"http:' + url + '"';
        }
        if (isAbsoluteUrl(url)) {
            return '"' + url + '"';
        }

        return path.join(route, url);
    }

    function findUrl(string) {
        var data = {
            done: '',
            missing: ''
        };
        var x = string.indexOf('url(');
        if (x === -1) {
            data.done = string;
            return data;
        }

        data.done += string.substr(0, x + 4);

        string = string.substr(x + 4);
        var y = string.indexOf(')');
        if (y === -1) {
            data.missing = string;
            return data;
        }

        data.done += getCorrectUrl(string.substr(0, y));

        string = string.substr(y);

        var obj = findUrl(string);

        data.done += obj.done;
        data.missing = obj.missing;

        return data;
    }

    return {
        '_buffer': '',
        '_transform': function (chunk, encoding, done) {
            var s = this._buffer + chunk.toString('utf8');
            var data = findUrl(s);
            this._buffer = data.missing;
            this.push(new Buffer(data.done));
            done();
        },
        '_flush': function (done) {
            this.push(new Buffer(this._buffer));
            done();
        }
    };
};