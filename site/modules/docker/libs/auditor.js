'use strict';

var path = require('path');
var vasync = require('vasync');
var SEPARATOR = '_';
var AUDITPATH = '~~/stor/.joyent/docker/audit/';

function Auditor(call) {
    this.log = call.log;
    this.client = require('../../storage').MantaClient.createClient(call);
}

function formatDate(date) {
    date = date || new Date();
    function zeroPrefix(num) {
        return num < 10 ? '0' + num : num;
    }

    return [date.getFullYear(), zeroPrefix(date.getMonth() + 1), zeroPrefix(date.getDate())].join('-') + ' ' +
        [zeroPrefix(date.getHours()), zeroPrefix(date.getMinutes()), zeroPrefix(date.getSeconds())].join(':');
}

function createFileName() {
    return ([].concat.apply([], arguments).join(SEPARATOR) + '.json').replace(/\//g, '');
}

function genType(event) {
    return event.type + (event.type !== 'docker' ? ('+' + event.entry) : '');
}

Auditor.prototype.createHeadPath = function (event) {
    return this.getDockerDir(event, 'host') + '/' + createFileName(
            formatDate(event.date),
            genType(event),
            event.name
        );
};

Auditor.prototype.createPaths = function (event) {
    var paths = {head: this.createHeadPath(event), links: []};
    if (event.type !== 'docker') {
        var type = event.type + 's';
        paths.links.push(path.join(AUDITPATH, 'hosts', event.host, type, event.entry, createFileName(formatDate(event.date), event.name)));
        paths.links.push(path.join(AUDITPATH, type, event.entry, createFileName(
            formatDate(event.date),
            event.host,
            genType(event),
            event.name
        )));
    }

    paths.links.push(path.join(AUDITPATH, 'docker', createFileName(
        formatDate(event.date),
        event.host,
        genType(event),
        event.name
    )));
    return paths;
};

Auditor.prototype.search = function (type, host, entry, callback) {
    var self = this;
    var searchPath = AUDITPATH;

    function eventParser(file) {
        var basename = path.basename(file.name, '.json');
        var parsed = basename.split(SEPARATOR);
        var out = {raw: basename};
        if (!parsed.length || !basename) {
            return;
        }

        out.name = parsed.pop();
        if (type === 'docker') {
            var entryType = parsed.pop();
            out.type = entryType;
            if (entryType !== 'docker') {
                entryType = entryType.split('+');
                out.type = entryType[0];
                out.entry = entryType[1];
            }
        } else {
            out.type = type;
            out.entry = entry;
        }
        out.host = host;
        if (!host) {
            out.host = parsed.pop();
        }
        out.npDate = parsed.pop();
        out.date = new Date(out.npDate);
        return out;
    }

    function process(error, res) {
        if (error) {
            return callback(error);
        }
        var result = [];
        res.on('error', callback);
        res.on('entry', function (entry) {
            if (entry.type === 'object' && entry.name) {
                var parsed = eventParser(entry);
                if (parsed) {
                    result.push(parsed);
                }
            }
        });
        res.on('end', function () {
            callback(null, result);
        });
    }

    if (host) {
        searchPath += '/hosts/' + host;
    }
    if (type !== 'docker') {
        searchPath += '/' + type + 's';
        if (entry) {
            searchPath += '/' + entry;
        }
        self.client.ftw(searchPath, {}, process);
    } else {
        self.client.ftw(self.getDockerDir({type: type, host: host}, host && 'host'), {}, process);
    }
};

Auditor.prototype.get = function (event, callback) {
    var self = this;
    var filePath = self.createHeadPath(event);
    self.client.getFileContents(filePath, function (error, data) {
        if (error && error.statusCode !== 404) {
            return callback(error);
        }
        try {
            data = JSON.parse(data);
        } catch (e) {
            self.log.error({error: e.message}, 'Docker audit record is corrupted at path ' + filePath);
            data = {error: true, errorMessage: 'Audit record is corrupted.'};
        }
        callback(null, data);
    });
};

Auditor.prototype.getDockerDir = function (event, type) {
    return path.join(AUDITPATH, type === 'host' ? 'hosts/' + event.host.replace(/\//g, '') : '', 'docker');
};

Auditor.prototype.put = function (event, body, callback) {
    body = body || {};
    event.date = event.date || new Date();
    var self = this;
    var paths = self.createPaths(event);
    callback = callback || function (error) {
        if (error) {
            return self.log.error({error: error}, 'Failed to write event');
        }
    };

    self.client.safeMkdirp(path.dirname(paths.head), {copyRoles: true}, function (error) {
        if (error) {
            return callback(error);
        }
        self.client.putFileContents(paths.head, JSON.stringify(body), function (error) {
            if (error) {
                return callback(error);
            }
            vasync.forEachParallel({
                inputs: paths.links,
                func: function (link, callback) {
                    self.client.safeMkdirp(path.dirname(link), {copyRoles: true}, function () {
                        self.client.ln(paths.head, link, callback);
                    });
                }
            }, function (errors) {
                if (errors) {
                    self.log.error({errors: errors}, 'Failed to write event');
                }

                callback.apply(this, arguments);
            });
        });
    });
};

Auditor.prototype.del = function (event, callback) {
    var self = this;
    var paths = self.createPaths(event);
    vasync.forEachParallel({
        inputs: [].concat(paths.links, paths.head),
        func: function (link, callback) {
            self.client.unlink(link, callback);
        }
    }, callback);
};

Auditor.prototype.ping = function (callback) {
    this.client.listDirectory(AUDITPATH, callback);
};

module.exports = Auditor;
