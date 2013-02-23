
module.exports = Authentication;

function Authentication() {

}

Authentication.getAuthenticator = function() {
  return function(req, res, next) {
    if (req.query.a) {
      next();
      return;
    }
    res.redirect('/login');
  };
};