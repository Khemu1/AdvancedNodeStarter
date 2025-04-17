const {clearHash}= require("../services/cache");

module.exports = (req, res, next) => {
  next();
  clearHash(`user-${req.user.id}`);
}