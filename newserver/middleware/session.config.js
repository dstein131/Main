const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const dbConfig = {
  host: 'main-1.c34qqac0y2dg.us-east-1.rds.amazonaws.com',
  user: 'your_db_user',
  password: 'your_db_password',
  database: 'main',
};

// Configure session store
const sessionStore = new MySQLStore(dbConfig);

const sessionMiddleware = session({
  key: 'user_sid',
  secret: 'your_secret_key', // Change this to a secure secret key
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    httpOnly: true, // Prevent client-side JavaScript from accessing cookies
    secure: false, // Set to true if using HTTPS
  },
});

module.exports = sessionMiddleware;
