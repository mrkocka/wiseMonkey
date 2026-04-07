const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = __dirname;

app.use("/css", express.static(path.join(publicDir, "css")));
app.use("/js", express.static(path.join(publicDir, "js")));
app.use("/img", express.static(path.join(publicDir, "img")));

app.get(["/", "/index.html"], (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get(["/banan", "/login.html"], (req, res) => {
  res.sendFile(path.join(publicDir, "login.html"));
});

app.get(["/dashboard", "/dashboard.html"], (req, res) => {
  res.sendFile(path.join(publicDir, "dashboard.html"));
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(publicDir, "404.html"));
});

app.listen(PORT, () => {
  console.log(`Wise Monkey server is running on http://localhost:${PORT}`);
});
