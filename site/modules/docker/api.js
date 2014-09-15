"use strict";

var restify = require('restify');
var qs = require('querystring');
var vasync = require('vasync');
var fs = require('fs');

var requestMap = {
    'GET': 'get',
    'PUT': 'put',
    'POST': 'post',
    'DELETE': 'del',
    'HEAD': 'head'
};

// read sync startup script for Docker
var startupScript = fs.readFileSync(__dirname + '/data/startup.sh', 'utf8');

function formatUrl(url, params) {
    //noinspection JSLint
    return url.replace(/(?::(\w+))/g, function (part, key) {
        var value = params[key];
        delete params[key];
        return value;
    });
}

function createCallback(callback) {
    //noinspection JSLint
    return function (error, req, res, data) {
        if (error) {
            return callback(error);
        }
        callback(null, data);
    };
}

function createMethod(opts) {
    return function (params, callback) {
        if (!callback) {
            callback = params;
            params = {};
        }
        if (!callback) {
            callback = function () {};
        }


        var options = {
            log: this.client.log,
            path: formatUrl(opts.path, params),
            method: opts.method || 'GET'
        };
        var query = {};
        var param;

        for (param in opts.params) {
            if (opts.params.hasOwnProperty(param) && params.hasOwnProperty(param)) {
                query[param] = params[param];
                delete params[param];
            }
        }
        options.path += '?' + qs.stringify(query);
        if (options.method === 'POST' || options.method === 'PUT') {
            options.data = params;
        }

        this.client[requestMap[options.method]](options, createCallback(callback));
    };
}

function createApi(map, container) {
    var name;
    for (name in map) {
        if (map.hasOwnProperty(name)) {
            container[name] = createMethod(map[name]);
        }
    }
}

module.exports = function execute(scope, register) {
    var Machine = scope.api('Machine');
    var api = {};
    // http://docs.docker.com/reference/api/docker_remote_api_v1.14/
    var dockerAPIMethods = {
        containers   : {
            method: 'GET',
            path: '/containers/json',
            params: {
                size   : '=',
                all    : '='
            }
        },
        inspect      : {
            method: 'GET',
            path: '/containers/:id/json'
        },
        top          : {
            method: 'GET',
            path: '/containers/:id/top',
            params: {
                ps_args: '='
            }
        },
        create       : {
            method: 'POST',
            path: '/containers/create',
            params: {
                name   : '='
            }
        },
        changes      : {
            method: 'GET',
            path: '/containers/:id/changes'
        },
        start        : {
            method: 'POST',
            path: '/containers/:id/start'
        },
        stop         : {
            method: 'POST',
            path: '/containers/:id/stop'
        },
        restart      : {
            method: 'POST',
            path: '/containers/:id/restart'
        },
        kill         : {
            method: 'POST',
            path: '/containers/:id/kill'
        },
        destroy     : {
            method: 'DELETE',
            path: '/containers/:id'
        },
        commit      : {
            method: 'POST',
            path: '/commit',
            params: {
                container: '=',
                repo     : '=',
                tag      : '=',
                m        : '=',
                author   : '=',
                run      : '='
            }
        },
        export       : {
            method: 'GET',
            path: '/containers/:id/export'
        },
        images       : {
            method: 'GET',
            path: '/images/json',
            params: {
                all    : '='
            }
        },
        inspectImage : {
            method: 'GET',
            path: '/images/:id/json'
        },
        getImageHistory : {
            method: 'GET',
            path: '/images/:id/history'
        },
        deleteImage  : {
            method: 'DELETE',
            path: '/images/:id'
        },
        searchImage  : {
            method: 'GET',
            path: '/images/search',
            params: {
                term   : '='
            }
        },
        getInfo         : {
            method: 'GET',
            path: '/info'
        },
        getVersion      : {
            method: 'GET',
            path: '/version'
        },
        auth         : {
            method: 'POST',
            path: '/auth'
        }
    };

    function Docker(client) {
        this.client = client;
    }

    createApi(dockerAPIMethods, Docker.prototype);

    Docker.prototype.getClient = function () {
        return this.client;
    };

    api.getMethods = function () {
        return Object.keys(dockerAPIMethods);
    };

    api.listHosts = function (call, callback) {
        vasync.forEachParallel({
            inputs: call.cloud.listDatacenters(),
            func: function (dcName, callback) {
                call.cloud.separate(dcName).listMachines({}, {JPC_tag: 'DockerHost'}, function (error, machines) {
                    if (error) {
                        return callback(error);
                    }
                    machines.forEach(function (machine) {
                        machine.datacenter = dcName;
                    });
                    callback(null, machines);
                });
            }
        }, function (errors, operations) {
            if (errors) {
                return callback(errors);
            }

            var hosts = [].concat.apply([], operations.successes);

            callback(null, hosts);
        });
    };

    api.preprocessMachine = function (data) {
        data.metadata['user-script'] = startupScript;
        data.tags['JPC_tag'] = 'DockerHost';
        return data;
    };

    api.postprocessMachine = function (data, callback) {
        return callback(null);
    };

    api.createClient = function (machine) {
        return new Docker(restify.createJsonClient({
            url: 'http://' + machine.primaryIp + ':4243'
        }));
    };

    register('Docker', api);
};