'use strict';

var path = require('path');

module.exports = function (secure, route) {
    var protocol = (secure ? '"https:' : '"http:');
    function isAbsoluteUrl(str) {
        if(str.indexOf('http://') === 0 || str.indexOf('https://') === 0) {
            return true;
        }
        return false;
    }

    function getCorrectUrl(url) {
        url = url.replace(/"/g,'').replace(/'/g,'');

        if (isAbsoluteUrl(url)) {
            return '"' + url + '"';
        }

        if (url.indexOf('//') === 0) {
            return  protocol + url + '"';
        }

        return path.join(route, url);
    }

    function findUrl(buffer, string) {
        var data = {
            done: '',
            reprocess: ''
        };
        var fullString = (buffer ? buffer : '') + string;
        //Look for the beginning of an url
        var x = fullString.indexOf('url(');
        if (x === -1) {
            // If on second round release previous chunk
            if(buffer) {
                data.done = buffer;
                data.reprocess = string;
                return data;
            }

            data.reprocess = string;
            return data;
        }

        //Add the pre-url part to done
        data.done += fullString.substr(0, x);

        string = fullString.substr(x);
        //Look for the end marker
        var y = string.indexOf(')');
        if (y === -1) { //If no end was in this chunk send for reprocessing
            data.reprocess = string;
            return data;
        }

        //Fix url and append
        data.done += 'url(' + getCorrectUrl(string.substr(4, y - 4)) + ')';

        string = string.substr(y + 1);

        // One url was processed, start over
        var obj = findUrl(null, string);

        data.done += obj.done;
        data.reprocess = obj.reprocess;

        return data;
    }

    return {
        _buffer: '',
        _transform: function (chunk, encoding, done) {
            var data = findUrl(this._buffer, chunk.toString('utf8'));
            this._buffer = data.reprocess;
            this.push(new Buffer(data.done));
            done();
        },
        _flush: function (done) {
            this.push(new Buffer(this._buffer));
            done();
        }
    };
};