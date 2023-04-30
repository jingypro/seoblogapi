const Tag = require("../models/tag");
const Blog = require("../models/blog");
const slugify = require("slugify");
const { errorHandler } = require("../helpers/dbErrorHandler");

exports.create = (req, res) => {
  const { name } = req.body;
  let slug = slugify(name).toLowerCase();
  let tag = new Tag({ name, slug });
  tag
    .save()
    .then((data) => res.json(data))
    .catch((err) => res.status(400).json({ error: errorHandler(err) }));
};

exports.list = (req, res) => {
  Tag.find({})
    .exec()
    .then((data) => {
      res.json(data);
    })
    .catch((err) => {
      return res.status(400).json({ error: errorHandler(err) });
    });
};

// exports.read = (req, res) => {
//   const slug = req.params.slug.toLowerCase();
//   Tag.findOne({ slug })
//     .exec()
//     .then((tag) => {
//       res.json(tag); // Later will return the blogs too
//     })
//     .catch((err) => {
//       return res.status(400).json({ error: errorHandler(err) });
//     });
// };

exports.read = async (req, res) => {
  const slug = req.params.slug.toLowerCase();

  try {
    const tag = await Tag.findOne({ slug }).exec();
    // console.log("Found tag:", tag);

    const blogs = await Blog.find({ tags: tag })
      .populate("categories", "_id name slug")
      .populate("tags", "_id name slug")
      .populate("postedBy", "_id name")
      .select(
        "id title slug excerpt categories postedBy tags createdAt updatedAt"
      )
      .exec();

    // console.log("Found blogs:", blogs);

    res.json({ tag: tag, blogs: blogs });
  } catch (err) {
    // console.log("Error in read function:", err);
    return res.status(400).json({ error: errorHandler(err) });
  }
};

exports.remove = (req, res) => {
  const slug = req.params.slug.toLowerCase();
  Tag.findOneAndRemove({ slug })
    .exec()
    .then(() => {
      res.json({ message: "Tag deleted successfully." });
    })
    .catch((err) => {
      return res.status(400).json({ error: errorHandler(err) });
    });
};
