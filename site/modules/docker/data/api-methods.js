'use strict';

// http://docs.docker.com/reference/api/docker_remote_api_v1.14/
var dockerAPIMethods = {
    containers: {
        auditType: 'docker',
        path: '/containers/json',
        params: {
            size: '=',
            all: '='
        }
    },
    list: {
        auditType: 'docker',
        path: '/containers/json',
        params: {
            all: true
        }
    },
    inspect: {
        auditType: 'container',
        path: '/containers/:id/json'
    },
    logs: {
        auditType: 'container',
        path: '/containers/:id/logs',
        noParse: true,
        params: {
            stdout: true,
            stderr: true,
            timestamps: true,
            tail: 100,
            follow: 0
        }
    },
    top: {
        auditType: 'container',
        path: '/containers/:id/top',
        params: {
            'ps_args': '='
        }
    },
    create: {
        method: 'POST',
        path: '/containers/create',
        params: {
            name: '='
        }
    },
    startImmediate: {
        method: 'POST',
        path: '/containers/:id/start'
    },
    changes: {
        auditType: 'container',
        path: '/containers/:id/changes'
    },
    start: {
        auditType: 'container',
        method: 'POST',
        path: '/containers/:id/start'
    },
    stop: {
        auditType: 'container',
        method: 'POST',
        path: '/containers/:id/stop'
    },
    pause: {
        auditType: 'container',
        method: 'POST',
        path: '/containers/:id/pause'
    },
    unpause: {
        auditType: 'container',
        method: 'POST',
        path: '/containers/:id/unpause'
    },
    restart: {
        auditType: 'container',
        method: 'POST',
        path: '/containers/:id/restart'
    },
    exec: {
        path: '/containers/:id/exec',
        method: 'POST'
    },
    execStart: {
        method: 'POST',
        path: '/exec/:id/start',
        raw: true,
        headers: {
            'User-Agent': 'Docker-Client/1.6.0',
            Connection: 'Upgrade',
            'Content-Type': 'text/plain',
            Upgrade: 'tcp'
        }
    },
    kill: {
        auditType: 'container',
        method: 'POST',
        path: '/containers/:id/kill'
    },
    remove: {
        auditType: 'container',
        method: 'DELETE',
        path: '/containers/:id',
        params: {
            v: '=',
            force: '='
        }
    },
    commit: {
        auditType: 'docker',
        method: 'POST',
        path: '/commit',
        params: {
            container: '=',
            repo: '=',
            tag: '=',
            m: '=',
            author: '=',
            run: '='
        }
    },
    stats: {
        raw: true,
        path: '/containers/:id/stats'
    },
    export: {
        auditType: 'container',
        method: 'GET',
        path: '/containers/:id/export'
    },
    containerUtilization: {
        method: 'POST',
        path: '/utilization/docker/:id',
        timeout: 3000,
        params: {
            'num_stats': 60,
            'num_samples': 0
        }
    },
    hostUtilization: {
        method: 'POST',
        path: '/utilization/',
        timeout: 3000,
        params: {
            'num_stats': 60,
            'num_samples': 0
        }
    },
    images: {
        auditType: 'docker',
        path: '/images/json',
        params: {
            all    : '='
        }
    },
    inspectImage: {
        auditType: 'image',
        path: '/images/:id/json'
    },
    tagImage: {
        auditType: 'image',
        method: 'POST',
        path: '/images/:name/tag',
        params: {
            repo: '=',
            tag: '=',
            force: '='
        }
    },
    pushImage: {
        auditType: 'image',
        raw: true,
        method: 'POST',
        path: '/images/:name/push',
        params: {
            tag: '='
        }
    },
    createImage: {
        auditType: 'docker',
        raw: true,
        method: 'POST',
        path: '/images/create',
        params: {
            fromImage: '=',
            tag: '=',
            registry: '=',
            repo: '='
        }
    },
    pullImage: {
        method: 'POST',
        path: '/images/create',
        params: {
            fromImage: '=',
            tag: '=',
            registry: '=',
            repo: '='
        }
    },
    buildImage: {
        auditType: 'docker',
        method: 'POST',
        path: '/build',
        raw: true,
        params: {
            t: '=',         // repository name (and optionally a tag) to be applied to the resulting image in case of success
            rm: '=',        // remove intermediate containers after a successful build (default behavior)
            nocache: '=',   // do not use the cache when building the image
            q: '='          // suppress verbose build output
        }
    },
    historyImage: {
        auditType: 'image',
        method: 'GET',
        path: '/images/:id/history'
    },
    removeImage: {
        auditType: 'image',
        method: 'DELETE',
        path: '/images/:id',
        params: {
            force: '=',
            noprune: '='
        }
    },
    getInfo: {
        auditType: 'docker',
        method: 'GET',
        path: '/info'
    },
    getVersion: {
        auditType: 'docker',
        method: 'GET',
        path: '/version',
        params: {
            retries: '=',
            timeout: '='
        }
    },
    auth: {
        auditType: 'docker',
        method: 'POST',
        path: '/auth'
    },
    ping: {
        retries: false,
        timeout: 3000,
        path: '/_ping'
    },
    memStat: {
        auditType: 'docker',
        method: 'GET',
        path: '/memStat/'
    }
};

var registryAPIMethods = {
    searchImage: {
        method: 'GET',
        path: '/v1/search',
        params: {
            q: '='
        }
    },
    removeImage: {
        method: 'DELETE',
        path: '/v1/repositories/:name/'
    },
    imageTags: {
        method: 'GET',
        path: '/v1/repositories/:name/tags'
    },
    removeImageTag: {
        method: 'DELETE',
        path: '/v1/repositories/:name/tags/:tag'
    },
    addImageTag: {
        method: 'PUT',
        raw: true,
        path: '/v1/repositories/:name/tags/:tag'
    },
    imageTagId: {
        path: '/v1/repositories/:name/tags/:tag'
    },
    ancestry: {
        path: '/v1/images/:id/ancestry'
    },
    inspect: {
        path: '/v1/images/:id/json'
    },
    ping: {
        method: 'GET',
        retries: false,
        timeout: 3000,
        path: '/v1/_ping'
    }
};

var indexAPIMethods = {
    images: {
        method: 'GET',
        path: '/v1/repositories/:name/images'
    },
    tokenRequest: {
        method: 'GET',
        headers: {
            'X-Docker-Token': true
        },
        path: '/v1/repositories/:name/:type'
    }
};

module.exports = {
    docker: dockerAPIMethods,
    registry: registryAPIMethods,
    index: indexAPIMethods
};
