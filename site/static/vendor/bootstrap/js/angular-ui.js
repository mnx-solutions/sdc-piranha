/**
 * AngularUI - The companion suite for AngularJS
 * @version v0.4.0 - 2013-04-09
 * @link http://angular-ui.github.com
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
angular.module("ui.config",[]).value("ui.config",{});
angular.module("ui.filters",["ui.config"]);
angular.module("ui.directives",["ui.config"]);
angular.module("ui",["ui.filters","ui.directives","ui.config"]);
