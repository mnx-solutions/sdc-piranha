var smartdc = require('smartdc');

module.exports = Authentication;

function Authentication() {
}

Authentication.getAuthenticator = function () {
  return function (req, res, next) {

    if (req.session.login != null) {
      req.cloud = smartdc.createClient({url:'https://10.88.88.4',
        username:req.session.login.username,
        password:req.session.login.password});

      return next();
    }

    return res.redirect('/login');
  };
};