require('dotenv').config();
var express = require('express');
var CronJob = require('cron').CronJob;
var moment = require('moment');
var mongoose = require('mongoose')

var job = require('./job');
var job1 = require('./job1');
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


job1.runFaceRecognition()

// job.updateSuspended()
//job.runNonWhaleGuarantees()
// job.cancelOffers()
// job.generateBatchWhitelist()
// job.saveGcodes()
// job.updateWhitelist()
// job.runGuarantees()
// job.updateRebates()
//  job.updateLoans()
// job.updateAccessFee()

// job.checkGCodes()



// new CronJob('*/30 * * * * *', function () {   
//  console.log('Top 50 holders updated at ' + moment().format('YYYY-MM-DD HH:mm:ss'));
// }, null, true);

