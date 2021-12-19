const express = require("express");
const app = express();
const session = require('express-session');
const MemoryStore = require('memorystore')(session)
const passport = require('passport');
const Auth0Strategy = require('passport-auth0');
const path = require('path');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const flash = require('connect-flash');
const userInViews = require('./lib/middleware/userInViews');
const authRouter = require('./routes/auth');
const indexRouter = require('./routes/index');
const userInfoRouter = require('./routes/userinfo');
const boatsRouter = require('./routes/boats');
const loadsRouter = require('./routes/loads');
const usersRouter = require('./routes/users');
const bodyParser = require('body-parser');


dotenv.config();

app.set('views', path.join(__dirname, 'views'));
app.set('public', path.join(__dirname, 'public'));
app.use(express.static('public'));
app.set('view engine', 'pug');

app.use(cookieParser());
app.use(bodyParser.json());

 /**
  * Function to generate a random string for the
  * state value
  */
const generateSecret = (length=10) => {
    const val = Math.random().toString(36).substring(2, length) + Math.random().toString(36).substring(2, length);
    return val;
}

// configure express-session
const sess = {
    secret: process.env.SESSION_SECRET,
    store: new MemoryStore({
        checkPeriod: 2700000
    }),
    unset: 'destroy',
    cookie: {maxAge: 30 * 60 * 1000}, // 30 minutes
    resave: false,
    saveUninitialized: true
};

if (app.get('env') === 'production') {
    // Use secure cookies in production (requires SSL/TLS)
    sess.cookie.secure = true;

    app.set('trust proxy', 1);
}

app.use(flash());

// Configure passport to use Auth0
var strategy = new Auth0Strategy(
    {
        domain: process.env.AUTH0_DOMAIN,
        clientID: process.env.AUTH0_CLIENT_ID,
        clientSecret: process.env.AUTH0_CLIENT_SECRET,
        callbackURL: process.env.AUTH0_CALLBACK_URL,        
    },
    function (accessToken, refreshToken, extraParams, profile, done) {
        // accessToken is the token to call Auth0 API (not usually needed)
        // extraParams.id_token has the JSON Web Token
        // profile has all the information from the user
        
        const info = {
            profile: profile,
            extraParams: extraParams,
        };

        return done(null, info);
    }
);

passport.use(strategy);
app.use(session(sess));

app.use(passport.initialize());
app.use(passport.session());

// Keep smaller payload for user session
passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (user, done) {
    done(null, user);
});

app.use(function(req, res, next) {
    res.locals.isAuthenticated = req.isAuthenticated();
    next();
});

app.use(userInViews());
app.use('/', authRouter);
app.use('/', indexRouter);
app.use('/userinfo', userInfoRouter);
app.use('/', boatsRouter);
app.use('/', loadsRouter);
app.use('/', usersRouter);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});

module.exports.app;