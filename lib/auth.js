var smartdc = require('smartdc');

module.exports = Authentication;

function Authentication() {
}

Authentication.getAuthenticator = function () {
  return function (req, res, next) {

    var cloudUrl = global.JP.config.cloudapi.url;

    if (req.session.login != null) {
      req.cloud = smartdc.createClient({url: cloudUrl,
        username:req.session.login.username,
        password:req.session.login.password});

      return next();
    }

    return res.redirect('/login');
  };
};