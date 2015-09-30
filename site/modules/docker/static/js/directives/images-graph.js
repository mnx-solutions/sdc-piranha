'use strict';

(function (ng, app) {
    app.directive('imagesGraph', ['Docker', function (Docker) {
        return {
            restrict: 'EA',
            scope: {
                items: '='
            },
            templateUrl: 'docker/static/partials/graph-image-detail.html',
            replace: true,
            link: function (scope) {
                scope.showDetails = false;
                function getDetails(image) {
                    scope.detailsLoading = true;
                    Docker.inspectImage(image).then(function (info) {
                        scope.image = info || {};
                        scope.image.info = image;
                        scope.imageInfoTags = '';
                        if (image.RepoTags) {
                            scope.imageInfoTags = Docker.getImageTagsList(image.RepoTags);
                        }
                        scope.image.CreatedBy = scope.image.Config && scope.image.Config.Cmd ? scope.image.Config.Cmd.join(' ') : '';
                        scope.detailsLoading = false;
                    }, function (err) {
                        scope.detailsLoading = false;
                    });
                }

                function makeGraph(treeData) {

                // ************** Generate the tree diagram  *****************
                    var margin = {top: 30, right: 60, bottom: 30, left: 60},
                        graphDistance = 90,
                        width = 800 - margin.right - margin.left,
                        height = 600 - margin.top - margin.bottom;

                    var i = 0;
                    var maxDepth = 0;
                    var tree = d3.layout.tree()
                        .size([height, width]);
                    var svg;
                    var root = treeData[0];

                    update(root);

                    function update(source) {
                        // Compute the new tree layout.
                        var nodes = tree.nodes(source).reverse(),
                            links = tree.links(nodes);
                        // Normalize for fixed-depth.
                        nodes.forEach(function(d) {
                            maxDepth = d.depth > maxDepth ? d.depth : maxDepth;
                            d.y = d.depth * graphDistance;
                        });
                        height = maxDepth * graphDistance;
                        tree.size([height, width]);
                        svg = d3.select("#images-graph").append("svg")
                            .attr("width", width + margin.right + margin.left)
                            .attr("height", height + margin.top + margin.bottom)
                            .append("g")
                            .attr("transform", "translate(" + margin.left + "," + margin.bottom + ")");

                        var diagonal = d3.svg.diagonal()
                            .projection(function(d) { return [d.x, height - d.y]; });

                        // Declare the nodes¦
                        var node = svg.selectAll("g.node")
                            .data(nodes, function(d) { return d.id || (d.id = ++i); });

                        // Enter the nodes.
                        var nodeEnter = node.enter().append("g")
                            .on("click", click)
                            .attr("class", "node")
                            .attr("transform", function(d) {
                                return "translate(" + d.x + "," + (height - d.y) + ")";
                            });

                        nodeEnter.append("circle")
                            .attr("r", 10)
                            .style("fill", "#fff");

                        // Declare the links¦
                        var link = svg.selectAll("path.link")
                            .data(links, function(d) { return d.target.id; });

                        // Enter the links.
                        link.enter().insert("path", "g")
                            .attr("class", "link")
                            .attr("d", diagonal);
                    }

                    // Action children on click.
                    function click(d) {
                        var event = d3.event;
                        event.preventDefault();
                        if (scope.detailsLoading || d.fakeRoot) {
                            return;
                        }
                        var target = event.target;
                        if (d.isActive) {
                            d.isActive = false;
                            target.classList.remove('active');
                            scope.showDetails = false;
                        } else {
                            scope.marginTop = (maxDepth && maxDepth >= d.depth ? (maxDepth - d.depth) * graphDistance : 100) + 'px';
                            d.isActive = true;
                            var activeElement = document.querySelector('circle.active');
                            if (activeElement) {
                                activeElement.classList.remove('active');
                            }
                            scope.showDetails = true;
                            getDetails(d);
                            target.classList.add('active');
                        }
                    }
                }
                var indexes = {};
                scope.$watch('items', function (items) {
                    if (items && items.length > 0) {
                        items.forEach(function (item, index) {
                            indexes[item.Id] = index;
                        });
                        var getTree = function (items, indexes) {
                            var tree = [];
                            var nodes = ng.copy(items);
                            nodes.forEach(function (node) {
                                if (node.ParentId) {
                                    var index = indexes[node.ParentId];
                                    if (index) {
                                        var parentNode = nodes[index];
                                        parentNode.children = parentNode.children || [];
                                        nodes[index].children.push(node);
                                    }
                                } else {
                                    tree.push(node);
                                }
                            });

                            if (tree.length > 1) {
                                // adding fake root for tree
                                tree = [{children: tree, fakeRoot: true}];
                            }

                            return tree;
                        };
                        makeGraph(getTree(items, indexes));
                    }

                });
            }

        };
    }]);
}(window.angular, window.JP.getModule('docker')));