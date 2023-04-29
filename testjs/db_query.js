const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");

// DB connection
mongoose
  .connect("mongodb://localhost:27018/seoblog", {
    useNewUrlParser: true,
  })
  .then(() => console.log("DB connected"))
  .catch((err) => console.log("DB Error => ", err));

// find all blogs
mongoose.connection.once("open", async function () {
  const blogs = await mongoose.connection.db
    .collection("blogs")
    .find()
    .toArray();

  // loop through each blog and get the photo size
  blogs.forEach((blog) => {
    console.log(blog.photo.data.length());
  });

  // close connection
  mongoose.connection.close();
});
