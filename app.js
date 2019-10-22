const express = require("express");
const createError = require('http-errors');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const ejs = require('ejs');
const {router, handleSocket} = require('./routes/user');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

// user模块导出的socket
handleSocket(io);

io.on('connection', function (socket) {
    console.log('a user connected');
    socket.on('chat message', function (data) {
        io.emit('chat message', data);
    });
    socket.on('disconnect', function () {
        io.emit('chat message', '走了一个');
    })
});

app.all('*', function (req, res, next) {
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Origin", req.headers.origin);
    res.header("Access-Control-Allow-Headers", "Content-Type,username");
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
    next();
});
app.set('views', path.join(__dirname, 'public'));
app.engine('html', ejs.__express);
app.set('view engine', 'html');
app.use(cors({
    origin: ['http://127.0.0.1:1017'],  //指定接收的地址
    methods: ['GET', 'POST'],  //指定接收的请求类型
    alloweHeaders: ['Content-Type', 'Authorization']  //指定header
}));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/user', router);
app.use(function (req, res, next) {
    next(createError(404));
});
app.use(function (err, req, res, next) {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status(err.status || 500);
    res.render('index');
});
server.listen('1017', function (err) {
    if (err) {
        console.log(err);
        throw err;
    }
    console.log('Server listening on port 1017!')
});

module.exports = {app, io};
