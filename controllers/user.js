const User = require("../models/user.js");
const Blog = require("../models/blog.js");
const { errorHandler } = require("../helpers/dbErrorHandler");
const _ = require("lodash");
const formidable = require("formidable");
const fs = require("fs");

exports.read = (req, res) => {
  req.profile.hashed_password = undefined;
  return res.json(req.profile);
};

exports.publicProfile = (req, res) => {
  let username = req.params.username;

  User.findOne({ username })
    .exec()
    .then((userFromDB) => {
      if (!userFromDB) {
        return res.status(400).json({ error: "User not found" });
      }
      let user = userFromDB;
      let userId = user._id;

      return Blog.find({ postedBy: userId })
        .populate("categories", "_id name slug")
        .populate("tags", "_id name slug")
        .populate("postedBy", "_id name")
        .limit(10)
        .select(
          "_id title slug excerpt categories tags postedBy createdAt updatedAt"
        )
        .exec()
        .then((data) => {
          user.photo = undefined;
          user.hashed_password = undefined;
          res.json({
            user,
            blogs: data,
          });
        })
        .catch((err) => {
          return res.status(400).json({ error: errorHandler(err) });
        });
    })
    .catch((err) => {
      return res.status(400).json({ error: errorHandler(err) });
    });
};

exports.update = async (req, res) => {
  const form = new formidable.IncomingForm();
  form.keepExtension = true;
  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          reject(err);
        } else {
          resolve({ fields, files });
        }
      });
    });

    console.log("Parsed fields:", fields);
    console.log("Parsed files:", files);

    let user = req.profile;
    // user's existing role and email before update
    let existingRole = user.role;
    let existingEmail = user.email;
    if (fields && fields.username && fields.username.length > 12) {
      return res.status(400).json({
        error: "Username should be less than 12 characters long",
      });
    }
    if (fields.username) {
      fields.username = slugify(fields.username).toLowerCase();
    }

    let updatedFields = { ...fields };

    if (fields.password && fields.password.length > 0) {
      if (fields.password.length < 6) {
        return res.status(400).json({
          error: "Password should be mininum 6 characters long",
        });
      }
    } else {
      delete updatedFields.password;
    }

    user = _.extend(user, updatedFields);
    // user's existing role and email - dont update - keep it same
    user.role = existingRole;
    user.email = existingEmail;

    if (files.photo) {
      if (files.photo.size > 10000000) {
        return res.status(400).json({
          error: "Image should be smaller than 1Mb",
        });
      }
      console.log("files.photo:", files.photo);
      user.photo.data = fs.readFileSync(files.photo.filepath);
      user.photo.contentType = files.photo.type;
    }
    const savedUser = await user.save();
    savedUser.hashed_password = undefined;
    savedUser.salt = undefined;
    savedUser.photo = undefined;
    res.json(savedUser);
  } catch (err) {
    console.log("Update error:", err);
    res.status(400).json({
      error: errorHandler(err),
    });
  }
};

exports.photo = async (req, res) => {
  try {
    const username = req.params.username;
    const user = await User.findOne({ username }).exec();
    if (!user || !user.photo.data) {
      return res.status(400).json({
        error: "User not found",
      });
    }
    res.set("Content-Type", user.photo.contentType);
    res.send(user.photo.data);
  } catch (err) {
    res.status(400).json({
      error: errorHandler(err),
    });
  }
};
