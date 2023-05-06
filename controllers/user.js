const User = require("../models/user.js");
const Blog = require("../models/blog.js");
const { errorHandler } = require("../helpers/dbErrorHandler");
const _ = require("lodash");
const formidable = require("formidable");
const fs = require("fs");
const slugify = require("slugify");

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

// exports.update = async (req, res) => {
//   try {
//     const form = formidable({ keepExtensions: true });
//     form.parse(req, async (err, fields, files) => {
//       if (err) {
//         return res.status(400).json({
//           error: "Photo could not be uploaded",
//         });
//       }

//       let user = req.profile;
//       const existingRole = user.role;
//       const existingEmail = user.email;

//       if (fields && fields.username && fields.username.length > 12) {
//         return res.status(400).json({
//           error: "Username should be less than 12 characters long",
//         });
//       }

//       if (fields.username) {
//         fields.username = slugify(fields.username).toLowerCase();
//       }

//       if (fields.password && fields.password.length < 6) {
//         return res.status(400).json({
//           error: "Password should be min 6 characters long",
//         });
//       }

//       // Fetch the existing hashed_password and salt values
//       const { hashed_password, salt } = user;

//       // Create the updated user object
//       user = _.extend(user, fields);
//       user.role = existingRole;
//       user.email = existingEmail;

//       // Set the existing hashed_password and salt values to the updated user object
//       user.hashed_password = hashed_password;
//       user.salt = salt;

//       if (files.photo) {
//         if (files.photo.size > 10000000) {
//           return res.status(400).json({
//             error: "Image should be less than 1mb",
//           });
//         }
//         if (files.photo.path) {
//           user.photo.data = fs.readFileSync(files.photo.path);
//           user.photo.contentType = files.photo.type;
//         } else {
//           return res.status(400).json({
//             error: "Photo path is not defined",
//           });
//         }
//       }

//       const result = await user.save();
//       result.hashed_password = undefined;
//       result.salt = undefined;
//       result.photo = undefined;
//       res.json(result);
//     });
//   } catch (err) {
//     console.log("profile udpate error", err);
//     return res.status(400).json({
//       error: errorHandler(err),
//     });
//   }
// };

exports.update = async (req, res) => {
  try {
    let form = new formidable.IncomingForm();
    form.keepExtensions = true;

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          reject(err);
        } else {
          resolve({ fields, files });
        }
      });
    });

    let user = req.profile;
    user = _.extend(user, fields);

    if (fields.password && fields.password.length < 6) {
      return res.status(400).json({
        error: "Password should be min 6 characters long",
      });
    }

    if (files.photo) {
      // console.log(files.photo);
      if (files.photo.size > 1000000) {
        return res.status(400).json({
          error: `Image should be less than 1mb, but received a file of size ${files.photo.size} bytes`,
        });
      }
      user.photo.data = fs.readFileSync(files.photo.filepath);
      user.photo.contentType = files.photo.mimetype;
    }

    const result = await user.save();
    result.hashed_password = undefined;
    result.salt = undefined;
    result.photo = undefined;
    res.json(result);
  } catch (err) {
    console.error(err);
    if (err.message === "Photo could not be uploaded") {
      res.status(400).json({ error: err.message });
    } else {
      res.status(400).json({ error: errorHandler(err) });
    }
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
