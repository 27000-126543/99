const roleMiddleware = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `需要以下角色之一: ${roles.join(', ')}`,
      });
    }

    next();
  };
};

module.exports = roleMiddleware;
