'use strict';

(function (app) {

    app.filter('logo', function () {
        return function (name) {
            name = name && name.toLowerCase();

            var instances = {
                //soft
                apache: "apache",
                cassandra: "cassandra",
                couchdb: "couchdb",
                elasticsearch: "elasticsearch",
                ghost: "ghost",
                hadoop: "hadoop",
                java: "java",
                magento: "magento",
                manta: "manta",
                memcached: "memcached",
                mongodb: "mongodb",
                "mysql-cluster": "mysql",
                neo4j: "neo4j",
                nginx: "nginx",
                node: "node",
                percona: "percona",
                postgresql: "postgresql",
                rails: "rails",
                redis: "redis",
                riak: "riak",
                scalearc: "scalearc",
                steelapp: "stingray",
                stm: "stingray",
                wordpress: "wordpress",

                //os
                "arch-demo": "arch",
                base: "smart",
                centos: "centos",
                debian: "debian",
                fedora: "fedora",
                freebsd: "freebsd",
                multiarch: "smart",
                smartos: "smart",
                sngl: "smart",
                "minimal-32-lts": "smart",
                "minimal-64-lts": "smart",
                ssc: "ubuntu",
                standard: "smart",
                ubuntu: "ubuntu",
                ws20: "windows"
            };

            var result = instances[name];
            if (!result) {
                for (var instanceKey in instances) {
                    if (name && name.indexOf(instanceKey) !== -1) {
                        result = instances[instanceKey];
                        break;
                    }
                }
            }
            if (!result) {
                result = 'advanced-instance-default';
            }
            return result;
        };
    });

}(window.JP.getModule('Machine')));