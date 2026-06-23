export const requireTrainer = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  if (req.user.isTrainer !== true) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Trainer role required',
    });
  }

  return next();
};
