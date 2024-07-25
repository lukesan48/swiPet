const jwt = require("jsonwebtoken");
require("dotenv").config();

exports.createToken = function (fn, ln, id, un, ue) {
    return _createToken(fn, ln, id, un, ue);
}
_createToken = function (fn, ln, id, un, ue) {
    try {
        const expiration = new Date();
        const user = { userId: id, username: un, firstName: fn, lastName: ln, email: ue };

        const accessToken = jwt.sign(user, process.env.JWT_SECRET);

        // In order to exoire with a value other than the default, use the
        // following
        /*
        const accessToken= jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: '30m'} );
                          '24h'
                        '365d'
        */
        var ret = { accessToken: accessToken };
    }
    catch (e) {
        var ret = { error: e.message };
    }
    return ret;
}

exports.isExpired = function (token) {
    var isError = jwt.verify(token, process.env.JWT_SECRET,
        (err, verifiedJwt) => {
            if (err) {
                return true;
            }
            else {
                return false;
            }
        });

    return isError;
}

exports.refresh = function (token) {
    var ud = jwt.decode(token, { complete: true });

    var userId = ud.payload.userId;
    let username = ud.payload.username;
    var firstName = ud.payload.firstName;
    var lastName = ud.payload.lastName;
    let email = ud.payload.email;

    return _createToken(firstName, lastName, userId, username, email);
}
