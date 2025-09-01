var express = require('express');
var job = require('./job');


var routes = express.Router();


routes.get('/restart', function (req, res) {
    job.restartApp(res);
});


module.exports = routes