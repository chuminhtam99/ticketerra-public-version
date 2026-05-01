const Joi = require("joi");

// ✅ Registration validation (only the fields you send in req.body)
const validateRegistration = (data) => {
  const schema = Joi.object({
    username: Joi.string().min(3).max(100).required(),
    email: Joi.string().email().max(255).required(),
    password: Joi.string().min(6).max(255).required(),
    role: Joi.string().valid("user", "admin", "both").default("user"),
  });

  return schema.validate(data);
};

// ✅ Login validation
const validateLogin = (data) => {
  const schema = Joi.object({
    username: Joi.string().max(100).required(), // login by username or email
    password: Joi.string().min(6).max(255).required(),
  });

  return schema.validate(data);
};

module.exports = { validateRegistration, validateLogin };
