const User = require("../models/user.js");
const Blog = require("../models/blog.js");
const shortId = require("shortid");
const jwt = require("jsonwebtoken");
const { expressjwt } = require("express-jwt");
const { errorHandler } = require("../helpers/dbErrorHandler.js");
const _ = require("lodash");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const { OAuth2Client } = require("google-auth-library");

exports.preSignup = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      return res.status(400).json({
        error: "Email is taken",
      });
    }
    const token = jwt.sign(
      { name, email, password },
      process.env.JWT_ACCOUNT_ACTIVATION,
      { expiresIn: "10m" }
    );
    const emailData = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Account activation link`,
      html: `
          <p>Please use the following link to activate your acccount:</p>
          <p>${process.env.CLIENT_URL}/auth/account/activate/${token}</p>
          <hr />
          <p>This email may contain sensetive information</p>
          <p>https://writivox.com</p>
      `,
    };
    await sgMail.send(emailData);
    return res.json({
      message: `Email has been sent to ${email}. Follow the instructions to activate your account.`,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

// exports.signup = async function createUser(req, res) {
//   try {
//     const user = await User.findOne({ email: req.body.email }).exec();
//     if (user) {
//       return res.status(400).json({
//         error: "Email is taken",
//       });
//     }
//     const { name, email, password } = req.body;
//     let username = shortId.generate();
//     let profile = `${process.env.CLIENT_URL}/profile/${username}`;
//     let newUser = new User({ name, email, password, profile, username });
//     const savedUser = await newUser.save();
//     // res.json({ user: savedUser });
//     res.json({ message: "Signup succeeded! Please sign in!" });
//   } catch (error) {
//     res.status(400).json({
//       error: error.message,
//     });
//   }
// };

exports.signup = (req, res) => {
  const token = req.body.token;
  if (token) {
    try {
      jwt.verify(
        token,
        process.env.JWT_ACCOUNT_ACTIVATION,
        async function (err, decoded) {
          if (err) {
            return res.status(401).json({
              error: "Expired link. Try signup again.",
            });
          }
          const { name, email, password } = jwt.decode(token);
          let username = shortId.generate();
          let profile = `${process.env.CLIENT_URL}/profile/${username}`;
          const user = new User({ name, email, password, profile, username });

          try {
            const savedUser = await user.save();
            return res.json({
              message: "Signup success! Please signin.",
            });
          } catch (err) {
            return res.status(401).json({
              error: errorHandler(err),
            });
          }
        }
      );
    } catch (err) {
      return res.status(401).json({
        error: "Expired link. Signup again.",
      });
    }
  } else {
    return res.json({
      message: "Something went wrong. Try again.",
    });
  }
};

exports.signin = (req, res) => {
  const { email, password } = req.body;
  // check if user exist
  User.findOne({ email })
    .exec()
    .then((user) => {
      if (!user) {
        throw new Error("User with that email does not exist. Please signup.");
      }
      // authenticate
      if (!user.authenticate(password)) {
        throw new Error("Email and password do not match.");
      }
      // success; generate a token and send to client
      const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "3d",
      });
      res.cookie("token", token, { expiresIn: "3d" });
      const { _id, username, name, email, role } = user;
      return res.json({ token, user: { _id, username, name, email, role } });
    })
    .catch((error) => {
      return res.status(400).json({ error: error.message });
    });
};

exports.signout = (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Signout succeeded" });
};

exports.requireSignin = expressjwt({
  secret: process.env.JWT_SECRET,
  algorithms: ["HS256"], // added later
  userProperty: "auth",
});

//-------MongooseError: Query.prototype.exec() no longer accepts a callback----------//
// exports.authMiddleware = (req, res, next) => {
//   const authUserId = req.auth._id;
//   User.findById({ _id: authUserId }).exec((err, user) => {
//     if (err || !user) {
//       return res.status(400).json({ error: "User not found" });
//     }
//     req.profile = user;
//     next();
//   });
// };

// exports.adminMiddleware = (req, res, next) => {
//   const adminUserId = req.auth._id;
//   User.findById({ _id: adminUserId }).exec((err, user) => {
//     if (err || !user) {
//       return res.status(400).json({ error: "User not found" });
//     }
//     if (user.role !== 1) {
//       return res.status(400).json({ error: "Admin resource. Access denied." });
//     }
//     req.profile = user;
//     next();
//   });
// };

exports.authMiddleware = (req, res, next) => {
  const authUserId = req.auth._id;
  User.findById(authUserId)
    .exec()
    .then((user) => {
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
      req.profile = user;
      next();
    })
    .catch((err) => {
      res.status(400).json({ error: err.message });
    });
};

exports.adminMiddleware = (req, res, next) => {
  const adminUserId = req.auth._id;
  User.findById(adminUserId)
    .exec()
    .then((user) => {
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
      if (user.role !== 1) {
        return res
          .status(400)
          .json({ error: "Admin resource. Access denied." });
      }
      req.profile = user;
      next();
    })
    .catch((err) => {
      res.status(400).json({ error: err.message });
    });
};

exports.canUpdateDeleteBlog = async (req, res, next) => {
  const slug = req.params.slug.toLowerCase();
  try {
    const data = await Blog.findOne({ slug }).exec();
    if (!data) {
      return res.status(400).json({ error: "Blog not found" });
    }
    const authorizedUser =
      data.postedBy._id.toString() === req.profile._id.toString();
    if (!authorizedUser) {
      return res.status(400).json({ error: "You are not authorized" });
    }
    next();
  } catch (err) {
    return res.status(400).json({ error: errorHandler(err) });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        error: "Cannot find user with the provided email",
      });
    }
    const token = jwt.sign({ _id: user._id }, process.env.JWT_RESET_PASSWORD, {
      expiresIn: "10m",
    });
    await user.updateOne({ resetPasswordLink: token });
    const emailData = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Password reset link`,
      html: `
          <p>Please use the following link to reset your password:</p>
          <p>${process.env.CLIENT_URL}/auth/password/reset/${token}</p>
          <hr />
          <p>This email may contain sensitive information</p>
          <p>https://writivox.com</p>
      `,
    };
    // console.log("Email data:", emailData);
    const result = await sgMail.send(emailData);
    // console.log("Email sent result:", result);
    return res.json({
      message: `Email has been sent to ${email}. Follow the instructions to reset your password. Link expires in 10 minutes.`,
    });
  } catch (err) {
    // console.log("Error in forgotPassword:", err);
    return res.status(500).json({ error: errorHandler(err) });
  }
};

exports.resetPassword = (req, res) => {
  const { resetPasswordLink, newPassword } = req.body;

  if (resetPasswordLink) {
    jwt.verify(
      resetPasswordLink,
      process.env.JWT_RESET_PASSWORD,
      async function (err, decoded) {
        if (err) {
          return res.status(401).json({
            error: "Expired link. Try again.",
          });
        }
        try {
          const user = await User.findOne({ resetPasswordLink });
          if (!user) {
            return res.status(401).json({
              error: "Something went wrong. Try later",
            });
          }
          const updatedFields = {
            password: newPassword,
            resetPasswordLink: "",
          };

          _.extend(user, updatedFields);

          await user.save();
          res.json({
            message: "Great! Now you can login with your new password.",
          });
        } catch (err) {
          return res.status(400).json({
            error: errorHandler(err),
          });
        }
      }
    );
  }
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
  try {
    const idToken = req.body.tokenId;
    const response = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    // console.log(response.payload);
    const { email_verified, name, email, jti } = response.payload;
    if (email_verified) {
      const user = await User.findOne({ email }).exec();
      if (user) {
        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
          expiresIn: "3d",
        });
        res.cookie("token", token, { expiresIn: "3d" });
        const { _id, email, name, role, username } = user;
        return res.json({
          token,
          user: { _id, email, name, role, username },
        });
      } else {
        let username = shortId.generate();
        let profile = `${process.env.CLIENT_URL}/profile/${username}`;
        let password = jti;
        const newUser = new User({ name, email, profile, username, password });
        const user = await newUser.save();
        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
          expiresIn: "3d",
        });
        res.cookie("token", token, { expiresIn: "3d" });
        return res.json({
          token,
          user: { _id: user._id, email, name, role: user.role, username },
        });
      }
    } else {
      return res.status(400).json({
        error: "Google login failed. Try again.",
      });
    }
  } catch (err) {
    return res.status(500).json({
      error: "Server error. Please try again later.",
    });
  }
};
