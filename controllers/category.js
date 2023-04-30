const Category = require("../models/category");
const Blog = require("../models/blog");
const slugify = require("slugify");
const { errorHandler } = require("../helpers/dbErrorHandler");

exports.create = (req, res) => {
  const { name } = req.body;
  let slug = slugify(name).toLowerCase();
  let category = new Category({ name, slug });
  category
    .save()
    .then((data) => res.json(data))
    .catch((err) => res.status(400).json({ error: errorHandler(err) }));
};

exports.list = (req, res) => {
  Category.find({})
    .exec()
    .then((data) => {
      res.json(data);
    })
    .catch((err) => {
      return res.status(400).json({ error: errorHandler(err) });
    });
};

exports.read = async (req, res) => {
  const slug = req.params.slug.toLowerCase();

  try {
    const category = await Category.findOne({ slug }).exec();
    // res.json(category); // Later will return the blogs too

    const blogs = await Blog.find({ categories: category })
      .populate("categories", "_id name slug")
      .populate("tags", "_id name slug")
      .populate("postedBy", "_id name")
      .select(
        "id title slug excerpt categories postedBy tags createdAt updatedAt"
      )
      .exec();

    res.json({ category: category, blogs: blogs });
  } catch (err) {
    return res.status(400).json({ error: errorHandler(err) });
  }
};

exports.remove = (req, res) => {
  const slug = req.params.slug.toLowerCase();
  Category.findOneAndRemove({ slug })
    .exec()
    .then(() => {
      res.json({ message: "Category deleted successfully." });
    })
    .catch((err) => {
      return res.status(400).json({ error: errorHandler(err) });
    });
};
