const express = require("express");
const bodyParser = require("body-parser");

// 创建服务
const app = express();

// 使用 body-parser 中间
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 创建路由
app.post("/login", function (req, res) {
    console.log(req.body);
    res.send(req.body);
});

// 监听服务
app.listen(3000, function () {
    console.log("server start 3000");
});
