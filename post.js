const express = require("express");
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.post("/order", function (req, res) {
    console.log(JSON.stringify(req.body));
    res.send({hello: 'adsfafaf'});
})
app.listen(1017, () => console.log('Server listening on port 1017!'));
