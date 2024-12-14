const jwt = require('jsonwebtoken');

// Middleware to authenticate the user using JWT
exports.authenticateJWT = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token.' });
        }

        req.user = user;
        next();
    });
};


