angular.module("ui.bootstrap", ["ui.bootstrap.tpls", "ui.bootstrap.alert"]);

angular.module("ui.bootstrap.tpls", ["template/alert/alert.html"]);

angular.module("ui.bootstrap.alert", []).directive('alert', function () {
  return {
    restrict:'EA',
    templateUrl:'template/alert/alert.html',
    transclude:true,
    replace:true,
    scope:{
      type:'=',
      close:'&'
    }
  };
});
angular.module("template/alert/alert.html", []).run(["$templateCache", function($templateCache){
  $templateCache.put("template/alert/alert.html",
    "<div class='alert' ng-class='type && \"alert-\" + type'>" +
    "    <button type='button' class='close' ng-click='close()'>&times;</button>" +
    "    <div ng-transclude></div>" +
    "</div>");
}]);
