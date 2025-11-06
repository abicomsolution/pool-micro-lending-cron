require('dotenv').config();
var express = require('express');
var CronJob = require('cron').CronJob;
var moment = require('moment');
var mongoose = require('mongoose')

var job = require('./job');

const config = {
    mongoURL: process.env.DB,
    port: 6009
}


mongoose.connect(config.mongoURL, { useNewUrlParser: true })
.then((respo) => {
    console.log("MongoDB connected")
})
.catch((error) => {
    console.log(error)
})

// job.updateWhitelist()
// job.runGuarantees()
// job.updateRebates()
// job.updateLoans()
// job.updateAccessFee()

// new CronJob('*/30 * * * * *', function () {   
//  console.log('Top 50 holders updated at ' + moment().format('YYYY-MM-DD HH:mm:ss'));
// }, null, true);

