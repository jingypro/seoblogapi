const Blog = require("../models/blog");
const Category = require("../models/category");
const Tag = require("../models/tag");
const User = require("../models/user");
const { errorHandler } = require("../helpers/dbErrorHandler");
const { smartTrim } = require("../helpers/blog");
// const { stripHtml } = require("string-strip-html");
const formidable = require("formidable");
const slugify = require("slugify");
const _ = require("lodash");
const fs = require("fs");
const sharp = require("sharp");
// const { stripHtml } = require("string-strip-html");

//////Resize larger images to < 1MB ///////
////////////////////////////////////////////
const resizeImage = async (filePath) => {
  let buffer = await sharp(filePath).jpeg({ quality: 90 }).toBuffer();
  let sizeInMB = buffer.length / 1000000;

  while (sizeInMB > 1) {
    buffer = await sharp(buffer).jpeg({ quality: 80 }).toBuffer();
    sizeInMB = buffer.length / 1000000;
  }

  return buffer;
};

exports.create = (req, res) => {
  let form = new formidable.IncomingForm();
  form.keepExtensions = true;
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({ error: "Image could not upload" });
    }
    const { title, body, categories, tags } = fields;

    // Validate request//
    ///////////////////////
    if (!title || !title.length) {
      return res.status(400).json({ error: "Title is required." });
    }
    if (!body || body.length < 200) {
      return res.status(400).json({ error: "Content is too short." });
    }
    if (!categories || categories.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one category is required." });
    }
    if (!tags || tags.length === 0) {
      return res.status(400).json({ error: "At least one tag is required." });
    }

    // Construct new blog//
    ///////////////////////
    let blog = new Blog();
    blog.title = title;
    blog.body = body;
    blog.slug = slugify(title).toLowerCase();
    blog.mtitle = `${title} | ${process.env.APP_NAME}`;
    blog.postedBy = req.auth._id;
    // Categories and tags
    let arrayOfCategories = categories && categories.split(",");
    let arrayOfTags = tags && tags.split(",");

    // If the file size is > 1MB, shrink it down before saving it.
    // Only check or convert photo size when there is a photo uploaded
    if (files.photo) {
      if (files.photo.size > 1000000) {
        try {
          const buffer = await resizeImage(files.photo.filepath);
          blog.photo.data = buffer;
          blog.photo.contentType = files.photo.type;
        } catch (error) {
          return res.status(400).json({ error: "Error resizing image to 1MB" });
        }
      } else {
        blog.photo.data = fs.readFileSync(files.photo.filepath);
        blog.photo.contentType = files.photo.type;
      }
    }

    // string-strip-html cannot use require
    // The import() function returns a promise, and the promise is asynchronous.
    // This means that blog.mdesc will be undefined until the promise resolves, which may be after you've sent the response.
    // To solve this issue, move the code that sends the response into the .then

    // string-strip-html cannot use require
    // The import() function returns a promise, and the promise is asynchronous.
    // This means that blog.mdesc will be undefined until the promise resolves, which may be after you've sent the response.
    // To solve this issue, move the code that sends the response into the .then() block of the import() function.
    import("string-strip-html")
      .then((module) => {
        // Get mdesc
        const stripHtml = module.stripHtml;
        const excerpt = smartTrim(body, 320, " ", " ...");
        blog.excerpt = stripHtml(excerpt).result;
        blog.mdesc = stripHtml(body.substring(0, 160)).result;
        // Save blog
        blog
          .save()
          .then((result) => {
            // Push categories and tags
            const pushCategories = Blog.findByIdAndUpdate(
              result._id,
              { $push: { categories: arrayOfCategories } },
              { new: true }
            );
            const pushTags = Blog.findByIdAndUpdate(
              result._id,
              { $push: { tags: arrayOfTags } },
              { new: true }
            );
            Promise.all([pushCategories, pushTags])
              .then(([_, updatedBlogTags]) => {
                res.json(updatedBlogTags);
              })
              .catch((err) => {
                return res.status(400).json({ error: errorHandler(err) });
              });
          })
          .catch((err) => {
            return res.status(400).json({ error: errorHandler(err) });
          });
      })
      .catch((error) => {
        console.log(error);
      });
  });
};

exports.list = (req, res) => {
  Blog.find({})
    .populate("categories", "_id name slug")
    .populate("tags", "_id name slug")
    .populate("postedBy", "_id name username")
    .select(
      "_id title slug excerpt categories tags postedBy createdAt updatedAt"
    )
    .exec()
    .then((data) => {
      res.json(data);
    })
    .catch((err) => {
      res.json({ error: errorHandler(err) });
    });
};

exports.listAllBlogsCategoriesTags = (req, res) => {
  let limit = req.body.limit ? parseInt(req.body.limit) : 10;
  let skip = req.body.skip ? parseInt(req.body.skip) : 0;

  let blogs;
  let categories;
  let tags;

  Blog.find({})
    .populate("categories", "_id name slug")
    .populate("tags", "_id name slug")
    .populate("postedBy", "_id name username profile")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select(
      "_id title slug excerpt categories tags postedBy createdAt updatedAt"
    )
    .exec()
    .then((data) => {
      // blogs
      blogs = data;
      // categories and tags promises
      const categoriesPromise = Category.find({}).exec();
      const tagsPromise = Tag.find({}).exec();

      //return everything
      return Promise.all([categoriesPromise, tagsPromise]);
    })
    .then(([categories, tags]) => {
      res.json({ blogs, categories, tags, size: blogs.length });
    })
    .catch((err) => {
      res.json({ error: errorHandler(err) });
    });
};

exports.read = (req, res) => {
  const slug = req.params.slug.toLowerCase();
  Blog.findOne({ slug })
    // .select("-photo")
    .populate("categories", "_id name slug")
    .populate("tags", "_id name slug")
    .populate("postedBy", "_id name username")
    .select(
      "_id title body slug mtitle mdesc categories tags postedBy createdAt updatedAt"
    )
    .exec()
    .then((data) => {
      res.json(data);
    })
    .catch((err) => {
      res.json({ error: errorHandler(err) });
    });
};

exports.remove = (req, res) => {
  const slug = req.params.slug.toLowerCase();
  Blog.findOneAndRemove({ slug })
    .exec()
    .then((data) => {
      res.json({ message: "Blog deleted successfully." });
    })
    .catch((err) => {
      res.json({ error: errorHandler(err) });
    });
};

// exports.update = (req, res) => {
//   const slug = req.params.slug.toLowerCase();
//   Blog.findOne({ slug })
//     .exec()
//     .then((oldBlog) => {
//       let form = new formidable.IncomingForm();
//       form.keepExtensions = true;
//       form.parse(req, async (err, fields, files) => {
//         if (err) {
//           return res.status(400).json({ error: "Image could not upload" });
//         }

//         let slugBeforeMerge = oldBlog.slug;
//         oldBlog = _.merge(oldBlog, fields);
//         oldBlog.slug = slugBeforeMerge;

//         const { body, title, categories, tags } = fields;

//         if (categories) {
//           oldBlog.categories = categories.split(",");
//         }

//         if (tags) {
//           oldBlog.tags = tags.split(",");
//         }

//         // Validate request
//         if (!title || !title.length) {
//           return res.status(400).json({ error: "Title is required." });
//         }
//         if (!body || body.length < 200) {
//           return res.status(400).json({ error: "Content is too short." });
//         }
//         if (!categories || categories.length === 0) {
//           return res
//             .status(400)
//             .json({ error: "At least one category is required." });
//         }
//         if (!tags || tags.length === 0) {
//           return res
//             .status(400)
//             .json({ error: "At least one tag is required." });
//         }

//         // If the file size is > 1MB, shrink it down before saving it.
//         // Only check or convert photo size when there is a photo uploaded
//         if (files.photo) {
//           if (files.photo.size > 1000000) {
//             try {
//               const buffer = await resizeImage(files.photo.filepath);
//               oldBlog.photo.data = buffer;
//               oldBlog.photo.contentType = files.photo.type;
//             } catch (error) {
//               return res
//                 .status(400)
//                 .json({ error: "Error resizing image to 1MB" });
//             }
//           } else {
//             oldBlog.photo.data = fs.readFileSync(files.photo.filepath);
//             oldBlog.photo.contentType = files.photo.type;
//           }
//         }

//         import("string-strip-html")
//           .then((module) => {
//             // Get mdesc
//             if (body) {
//               const stripHtml = module.stripHtml;
//               const excerpt = smartTrim(body, 320, " ", " ...");
//               oldBlog.excerpt = stripHtml(excerpt).result;
//               oldBlog.mdesc = stripHtml(body.substring(0, 160)).result;
//             }
//             // Save blog
//             oldBlog
//               .save()
//               .then((result) => {
//                 // result.photo = undefined;
//                 res.json(result);
//               })
//               .catch((err) => {
//                 return res.status(400).json({ error: errorHandler(err) });
//               });
//           })
//           .catch((error) => {
//             console.log(error);
//           });
//       });
//     })
//     .catch((err) => {
//       res.json({ error: errorHandler(err) });
//     });
// };

exports.update = (req, res) => {
  const slug = req.params.slug.toLowerCase();
  Blog.findOne({ slug })
    .exec()
    .then((oldBlog) => {
      let form = new formidable.IncomingForm();
      form.keepExtensions = true;
      form.parse(req, async (err, fields, files) => {
        if (err) {
          return res.status(400).json({ error: "Image could not upload" });
        }

        Object.assign(oldBlog, fields);

        if (fields.categories) {
          oldBlog.categories = fields.categories.split(",");
        }

        if (fields.tags) {
          oldBlog.tags = fields.tags.split(",");
        }

        // Validate request
        if (fields.title && !fields.title.length) {
          return res.status(400).json({ error: "Title is required." });
        }
        if (fields.body && fields.body.length < 200) {
          return res.status(400).json({ error: "Content is too short." });
        }
        if (oldBlog.categories && oldBlog.categories.length === 0) {
          return res
            .status(400)
            .json({ error: "At least one category is required." });
        }
        if (oldBlog.tags && oldBlog.tags.length === 0) {
          return res
            .status(400)
            .json({ error: "At least one tag is required." });
        }

        // If the file size is > 1MB, shrink it down before saving it.
        // Only check or convert photo size when there is a photo uploaded
        if (files.photo) {
          if (files.photo.size > 1000000) {
            try {
              const buffer = await resizeImage(files.photo.filepath);
              oldBlog.photo.data = buffer;
              oldBlog.photo.contentType = files.photo.type;
            } catch (error) {
              return res
                .status(400)
                .json({ error: "Error resizing image to 1MB" });
            }
          } else {
            oldBlog.photo.data = fs.readFileSync(files.photo.filepath);
            oldBlog.photo.contentType = files.photo.type;
          }
        }

        import("string-strip-html")
          .then((module) => {
            // Get mdesc
            if (fields.body) {
              const stripHtml = module.stripHtml;
              const excerpt = smartTrim(fields.body, 320, " ", " ...");
              oldBlog.excerpt = stripHtml(excerpt).result;
              oldBlog.mdesc = stripHtml(fields.body.substring(0, 160)).result;
            }
            // Save blog
            oldBlog
              .save()
              .then((result) => {
                // result.photo = undefined;
                res.json(result);
              })
              .catch((err) => {
                return res.status(400).json({ error: errorHandler(err) });
              });
          })
          .catch((error) => {
            console.log(error);
          });
      });
    })
    .catch((err) => {
      res.json({ error: errorHandler(err) });
    });
};

exports.photo = (req, res) => {
  const slug = req.params.slug.toLowerCase();
  Blog.findOne({ slug })
    .select("photo")
    .exec()
    .then((blog) => {
      if (!blog) {
        throw new Error("Blog not found");
      }
      res.set("Content-Type", blog.photo.contentType);
      return res.send(blog.photo.data);
    })
    .catch((error) => {
      return res.status(400).json({ error: errorHandler(error) });
    });
};

exports.listRelated = (req, res) => {
  let limit = req.body.limit ? parseInt(req.body.limit) : 3;
  const { _id, categories } = req.body.blog;
  Blog.find({ _id: { $ne: _id }, categories: { $in: categories } })
    .limit(limit)
    .populate("postedBy", "_id name username profile")
    .select("title slug excerpt postedBy createdAt updatedAt")
    .exec()
    .then((blogs) => {
      res.json(blogs);
    })
    .catch((err) => {
      res.status(400).json({ error: "Blogs not found" });
    });
};

exports.listSearch = async (req, res) => {
  console.log(req.query);
  const { search } = req.query;
  if (search) {
    try {
      const blogs = await Blog.find({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { body: { $regex: search, $options: "i" } },
        ],
      })
        .select("-photo -body")
        .exec();

      res.json(blogs);
    } catch (err) {
      return res.status(400).json({ error: errorHandler(err) });
    }
  }
};

exports.listByUser = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).exec();
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }
    const userId = user._id;
    const data = await Blog.find({ postedBy: userId })
      // .populate("categories", "_id name slug")
      // .populate("tags", "_id name slug")
      .populate("postedBy", "_id name username")
      .select("_id title slug postedBy createdAt updatedAt")
      .exec();
    res.json(data);
  } catch (err) {
    return res.status(400).json({ error: errorHandler(err) });
  }
};
