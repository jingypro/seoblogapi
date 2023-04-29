const mongoose = require("mongoose");

// DB connection
mongoose
  .connect("mongodb://localhost:27018/seoblog", {
    useNewUrlParser: true,
  })
  .then(() => console.log("DB connected"))
  .catch((err) => console.log("DB Error => ", err));

const User = require("./models/user");

// User.updateMany({}, { $set: { createdAt: new Date(), updatedAt: new Date() } })
//   .then((result) => {
//     if (result.nModified === 0) {
//       console.log("Update failed");
//     } else {
//       console.log("Update successful");
//     }
//   })
//   .catch((err) => {
//     console.log(err);
//   });

const update = {
  name: "Admin1",
  email: "admin1@writivox.com",
  createdAt: new Date(),
};

User.findByIdAndUpdate("640ca9053dae177590e04785", update, { new: true })
  .then((user) => {
    console.log("success");
  })
  .catch((err) => {
    console.log(err);
  });
