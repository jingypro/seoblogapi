const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.contactForm = (req, res) => {
  const { name, email, message } = req.body;
  //   console.log(data);
  const emailData = {
    to: process.env.EMAIL_TO,
    from: process.env.EMAIL_FROM,
    subject: `Contact from - ${process.env.APP_NAME}`,
    text: `Email received from contact from \n Sender name: ${name} \n Send email: ${email} \n Sender message: ${message}`,
    html: `
    <h4>Email received from contact form:</h4>
    <p>Sender name: ${name}</p>
    <p>Sender email address: ${email}</p>
    <p>Sender message: ${message}</p>
    <hr />
    <p>This email may contact sensitive information</p>
    <p>https://writivox.com</p>
    `,
  };
  sgMail.send(emailData).then((sent) => {
    return res.json({ success: true });
  });
};

exports.contactBlogAuthorForm = (req, res) => {
  const { authorEmail, email, name, message } = req.body;
  let maillist = [authorEmail, process.env.EMAIL_TO]; //   console.log(data);
  const emailData = {
    to: maillist,
    from: process.env.EMAIL_FROM,
    subject: `Someone messaged you from ${process.env.APP_NAME}`,
    text: `Email received from contact from \n Sender name: ${name} \n Send email: ${email} \n Sender message: ${message}`,
    html: `
      <h4>Message received form:</h4>
      <p>Name: ${name}</p>
      <p>Email address: ${email}</p>
      <p>Message: ${message}</p>
      <hr />
      <p>This email may contact sensitive information</p>
      <p>https://writivox.com</p>
      `,
  };
  sgMail.send(emailData).then((sent) => {
    return res.json({ success: true });
  });
};
