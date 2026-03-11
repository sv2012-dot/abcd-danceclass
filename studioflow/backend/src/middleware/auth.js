const jwt = require('jsonwebtoken');

function auth(...roles) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = header.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

function sameSchool(req, res, next) {
  const schoolId = parseInt(req.params.schoolId || req.body.school_id);
  if (req.user.role === 'superadmin') return next();
  if (req.user.school_id !== schoolId) {
    return res.status(403).json({ error: 'Access denied to this school' });
  }
  next();
}

module.exports = { auth, sameSchool };
