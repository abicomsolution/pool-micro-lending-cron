const Member = require("./models/member")
const Offer = require("./models/offer")
const Accessfee = require("./models/accessfee")
const Whitelist = require("./models/whitelist")
const Gcode = require("./models/gcode")
const _ = require("lodash")
const async = require("async")
const moment = require("moment")
var ObjectId = require('mongoose').Types.ObjectId;

const { uuid } = require('uuidv4');
const fs = require('fs');
const axios = require("axios");
const { ethers, JsonRpcProvider, parseEther, formatEther  } = require('ethers')
const PMLContractConfig = require("./pmlAbi")
const PFBContractConfig = require("./pfbAbi")
const PFIContractConfig = require("./pfiAbi")
const PFSContractConfig = require("./pfsAbi")
const PFGContractConfig = require("./pfgAbi")
const pairCon = require("./pairCon.json")
const Rebates = require("./models/rebates")
const GuaranteeContractConfig = require("./guaranteeAbi")

var customHttpProvider = new JsonRpcProvider("https://bsc-dataseed.binance.org");

function stripExcessDecimals(amount) {
    var amountStr = amount.toString();

    if (amountStr.length > 18) {
        var sp = amountStr.split(".")
        if (sp.length > 1) {
            var deci = sp[1]
            var dec1 = deci.substring(0, 18)
            amountStr = sp[0] + "." + dec1
            return amountStr
        } else {
            return amountStr;
        }
    } else {
        return amountStr;
    }
}

function roundToTwo(num) {
    return +(Math.round(num + "e+2")  + "e-2");
}


function Job() {

    this.runNonWhaleGuarantees = async function () {   

        console.log("Running non-whale guarantees...")

        let opeloans = []     
        let qloans = [] 
        let pmlprice = 0    

        const getOpenloans = function(){
            return new Promise(function(resolve, reject) {          
                // Only get offers for the year 2025
                const startOf2025 = new Date("2025-01-01T00:00:00.000Z");
                // const endOf2025 = new Date("2025-12-31T23:59:59.999Z");
                const tenthJan = new Date("2026-01-10T23:59:59.999Z");
                Offer.find({ 
                    status: 0,
                    transdate: {  $lte: tenthJan }
                })
                .populate("member_id")
                .populate("borrower_id")
                .sort({ transdate: 1 })
                .then((result) => {                    
                    console.log("Total open loans in 2025: " + result.length);     
                    opeloans = result;                                 
                    resolve();
                })

            })
        }
      
    

        const getPMLPrice= function(){
            return new Promise(function(resolve, reject) {          
                pullPMLPrice((price)=>{                
                    pmlprice = price
                    resolve()
                })    
            })
        }            

        const filterQualified = function(){
            return new Promise(async function(resolve, reject) {      
                for (const e of opeloans) {                                 
                    try{
                        let url = "https://poolfunding.io/api/check-status/"+ e.member_id.walletaddress
                        console.log(url)
                        let res = await axios.get(url)
                        if (res.data && res.data.status == 1) {                              
                            if (res.data.data && res.data.data.isSuspended) {
                                console.log("Suspended in PF: " + e.member_id.walletaddress)                                                             
                            }else if (res.data.data && !res.data.data.isVerified) {
                                console.log("Not verified in PF: " + e.member_id.walletaddress)                                                                                                         
                            }else if (res.data.data && !res.data.data.isTusted) {
                                console.log("Not isTrusted in PF: " + e.member_id.walletaddress)                                                                                                          
                            }else{  
                                if (e.member_id.status==0){
                                    console.log("count:" + qloans.length)                                                                                              
                                    qloans.push(e)                            
                                }else{
                                    console.log("Suspended in PML: " + e.member_id.walletaddress)
                                }
                                
                                // if (qloans.length==400){
                                //     break;                                    
                                // }
                            }                                    
                        }else{
                            console.log("Not found in PF: " + e.member_id.walletaddress)                                                              
                        }                                                   
                    }catch(err){
                        console.error("Error occurred while waiting:", err.name)
                    }                    
                }                       
                resolve()                      
            })
        }

        const updateLoans = function(){
            return new Promise(async function(resolve, reject) {                                          
                let totalpml = 0                
                let countpml = 0                                              
                async.eachSeries(qloans, function (e, next) {                                                              
                    console.log("Processing Loan Ref#: " + e.refno + " Borrower: " + e.member_id.fullname + " address: " + e.member_id.walletaddress + " Date : " + moment(e.transdate).format("YYYY-MM-DD"))
                    // next()
                    guaranteeLoan(e, pmlprice, function(amount){                    
                        countpml += 1
                        totalpml += Number(amount)                   
                        next()
                    })      
                }, function () {
                    console.log("Total open loans for guarantee: " + qloans.length)
                    console.log("Total PML collateral needed: " + countpml + " (" + roundToTwo(totalpml) + " PML)")                                      
                    resolve()
                })                                
            })
        }

        getOpenloans()   
        .then(filterQualified)    
        .then(getPMLPrice)       
        .then(updateLoans)
        .then(function () {
            console.log("Done updating guarantees")
        })
        .catch(function(err){
            console.log(err)            
        })

    }
    

    this.runGuarantees = async function () {   

        let whitelist = []
        let whales = []
        let pmlprice = 0

        // let whitelist = require("./whitelist.json")

        const getWhitelist = function(){
            return new Promise(function(resolve, reject) {          

                whitelist.push("0xde82acaeebe15fec29f5b14e37f74c4469960e18")
                resolve()

                // Whitelist.find({status: 1})
                // .then((result) => {
                //     whitelist = result.map(w => w.walletaddress)
                //     console.log("Total whitelist addresses: " + whitelist.length)
                //     resolve()
                // })
                // .catch((err) => {
                //     console.log(err)
                //     reject(err)
                // })
            })
        }
      
        const getWhales = function(){
            return new Promise(function(resolve, reject) {  
                console.log(whitelist)        
                Member.find({walletaddress: {$in: whitelist.map(addr => new RegExp(`^${addr}$`, 'i'))}})
                .then((result) => {
                    whales = result
                    console.log(whales)
                    console.log("Total whales found: " + whales.length + "/" + whitelist.length)
                    resolve()
                })
                .catch((err) => {
                    console.log(err)
                    reject(err)
                })
            })
        }

        const getPMLPrice= function(){
            return new Promise(function(resolve, reject) {          
                pullPMLPrice((price)=>{                
                    pmlprice = price
                    resolve()
                })    
            })
        }            

        

        const updateLoans = function(){
            return new Promise(async function(resolve, reject) {          
                let loans = []
                let totall = 0
                let totalpml = 0                
                let countpml = 0              

                for (const e of whales) {               
                    let offers = await Offer.find({member_id: e._id, status: 0}).populate("member_id").populate("borrower_id")        
                    totall += offers.length                
                    loans.push(...offers)
                }

                
                let ctr = 0
                async.eachSeries(loans, function (e, next) {                     
                    ctr += 1                            
                    guaranteeLoan(e, pmlprice, function(amount){                    
                        countpml += 1
                        totalpml += Number(amount)                   
                        next()
                    })      
                }, function () {
                    console.log("Total open loans for guarantee: " + ctr)
                    console.log("Total PML collateral needed: " + countpml + " (" + roundToTwo(totalpml) + " PML)")                    
                    console.log("Total open loans for whales: " + totall)
                    resolve()
                })                                
            })
        }

        getWhitelist()
        .then(getWhales)
        .then(getPMLPrice)       
        .then(updateLoans)
        .then(function () {
            console.log("Done updating guarantees")
        })
        .catch(function(err){
            console.log(err)            
        })

    }
    

    async function guaranteeLoan(data, pmlprice, cb) {
        
        let amount = 0      
        try{
            sendPMLTokens(data, pmlprice,  function(txhash){                             
                let params = {
                    status: 4,
                    ispaid: true,
                    pay_pml_txhash: txhash,                          
                    paid_at: moment().toDate()       
                }
                Offer.findByIdAndUpdate(data._id, params)
                .then(()=>{
                    amount = 100 / pmlprice
                    cb(amount)
                })
                .catch((err)=>{ 
                    console.log(err)    
                    cb(0)
                })
            })          

        }catch(err){
            console.log(err)
            cb(0)
        }       
    }


    this.updateRebates= async function () {        

        let loanoffers = []
        let pmlprice = 0

        const getSixtyDaysLoans= function(){
            return new Promise(async function(resolve, reject) {          
                let result = await Offer.find({ispaid: true, hasRebate: false}).populate("member_id").populate("borrower_id")        
                console.log("Total paid loans: " + result.length)     

                for (const e of result) {
                    var now = moment(new Date())
                    var datel = moment(e.borrowed_at)
                    var duration = moment.duration(now.diff(datel));
                    var days = duration.asDays();                             
                    // console.log("Loan Ref#: " + e.refno + " Borrower: " + e.member_id.fullname + " Days: " + days + " Date Loaned: " + moment(e.borrowed_at).format("YYYY-MM-DD") )
                    if (days>=60) {                                                                                                   
                        try {
                            // let url = "http://localhost:5173/api/check-status/"+ e.borrower_id.walletaddress 
                            let url = "https://poolfunding.io/api/check-status/"+ e.borrower_id.walletaddress
                            console.log(url)
                            let res = await axios.get(url)
                            if (res.data && res.data.status == 1) {                              
                                if (res.data.data && res.data.data.isSuspended) {
                                    console.log("Suspended in PF:")                                         
                                }else if (res.data.data && !res.data.data.isVerified) {
                                    console.log("Not verified in PF: ")                                         
                                }else if (res.data.data && !res.data.data.isTusted) {
                                    console.log("Not isTrusted in PF: ")                                         
                                }else{                                    
                                    console.log("Loan Ref#: " + e.refno + " Borrower: " + e.borrower_id.fullname + " address: " + e.borrower_id.walletaddress + " Date Loaned: " + moment(e.borrowed_at).format("YYYY-MM-DD"))            
                                    loanoffers.push(e)
                                }                                    
                            }else{
                                console.log("Not found in PF")                                  
                            }   
                            // await new Promise(resolve => setTimeout(resolve, 1000))                                             
                        } catch (error) {
                            console.error("Error occurred while waiting:", error.name)
                        }                                                   
                        
                    }
                }
                console.log("Total 60 days loans: " + loanoffers.length)
                resolve()
            })
        }

        const getPMLPrice= function(){
            return new Promise(function(resolve, reject) {          
                pullPMLPrice((price)=>{                
                    pmlprice = price
                    resolve()
                })    
            })
        }            

        const iterateloanoffers = function(){
            return new Promise(function(resolve, reject){          
                    async.eachSeries(loanoffers, function (e, next) {                                                                     
                        saveAndSendRebate(e, pmlprice, function(){
                            next()                                                                        
                        })                        
                    }, function () {
                        resolve()
                    })    

            })
        }

        getSixtyDaysLoans()    
        .then(getPMLPrice)
        .then(iterateloanoffers)   
        .then(function () {
            console.log("Done")
        })
        .catch(function(err){
            console.log(err)            
        })

    }

    async function saveAndSendRebate(data, pmlprice, cb) {

        // console.log("saveAndSendRebate.....")
        // cb()

        try {

            console.log("Loan Ref#: " + data.refno + " Borrower: " + data.borrower_id.fullname + " address: " + data.borrower_id.walletaddress + " Date Loaned: " + moment(data.borrowed_at).format("YYYY-MM-DD"))            
            let params = {
                member_id: data.borrower_id._id,
                transdate: moment().toDate(),            
                txhash: "",     
                usdamount: 100,       
                amount: 0,
                loan_id: data._id
            }

            let newRebate = new Rebates(params)
            let nm = await newRebate.save()

            sendPMLRebates(data, pmlprice,  function(val){     
                console.log(val)               
                let params = { hasRebate: true}
                Offer.findByIdAndUpdate(data._id, params)
                .then(()=>{
                    Rebates.findByIdAndUpdate(nm._id, { txhash: val.hash, amount: val.amount }) 
                    .then(()=>{
                        cb()
                    })                
                })   
            })
        }catch(err){
            console.log(err)         
            cb()
        }
    }


    async function sendPMLRebates(data, pmlprice, cb) {

        // console.log("sendPMLTokens.....")
        // cb("hash")
        let retVal = {
            amount:0,
            hash: ""
        }
        const PK = process.env.SENDER_PK
        const cwallet = new ethers.Wallet(PK, customHttpProvider)              
        const pmlContract = new ethers.Contract(PMLContractConfig.address, PMLContractConfig.abi, customHttpProvider);
                 
        let pmltokens =  100 / pmlprice                
        let amtStr = stripExcessDecimals(pmltokens)         
        retVal.amount = Number(amtStr)

        if (Number(amtStr) > 0) {
            var bgamount = parseEther(amtStr)
            console.log("amount: " + bgamount)            
            // data.member_id.walletaddress  
            let receiver = data.borrower_id.walletaddress 
            //"0xc5Ee5EDe4DbE219eB0FB8b11F2953A9149350725"
            //data.member_id.walletaddress                                
            pmlContract.connect(cwallet).transfer(receiver, bgamount)
            .then((tx)=>{
                tx.wait(1)
                .then((receipt)=>{
                    console.log(receipt.hash)
                    retVal.hash = receipt.hash
                    // console.log("Loan Ref#: " + data.refno + " Lender: " + data.member_id.fullname + "(" + data.member_id.walletaddress + ")  Borrower: " + data.borrower_id.fullname + "(" + data.borrower_id.walletaddress + ") Date Loaned: " + moment(data.borrowed_at).format("YYYY-MM-DD")  + " payme: " + data.member_id.collateralpayment)
                    cb(retVal)                            
                })
                .catch((err)=>{
                    console.log(err)                            
                    cb(retVal)
                })                       
            })
            .catch((err)=>{
                console.log(err)                       
                cb(retVal)
            })                    
        } else {
            cb(retVal)
        }   

        // pmlContract.balanceOf(process.env.SENDER_FUND_ADDR)
        // .then((pmlBalance)=>{
                                                      
        // }).catch((err)=>{
        //     // console.log(err)
        //     console.log("e3")
        //     cb("")
        // })

    }

    this.updateLoans = async function () {        

        let defaultLoans = []
        let pmlprice = 0
        let pfiprice = 0
        let pfbprice = 0
        let pfsprice = 0
        let pfgprice = 0

        const getDefaultLoans= function(){
            return new Promise(function(resolve, reject) {          
                Offer.find({status: 1, ispaid: false })
                .populate("member_id")              
                .populate("borrower_id")        
                .then((result) => {

                    console.log("Total loans: " + result.length)            

                    async.eachSeries(result, function (e, next) {
                     
                        var now = moment(new Date())
                        var datel = moment(e.borrowed_at)
                        var duration = moment.duration(now.diff(datel));
                        var days = duration.asDays();                       
                        if (days>=30) {
                            let url = "https://poolfunding.io/api/check-status/"+ e.member_id.walletaddress
                            console.log(url)
                            axios.get(url)
                            .then((res) => {

                                if (res.data && res.data.status == 1) {                              
                                    if (res.data.data && res.data.data.isSuspended) {
                                        console.log("Suspended in PF: ")                                                             
                                        next()
                                    }else if (res.data.data && !res.data.data.isVerified) {
                                        console.log("Not verified in PF: ")                                                                                                         
                                        next()
                                    }else if (res.data.data && !res.data.data.isTusted) {
                                        console.log("Not isTrusted in PF: ")                                                                                                          
                                        next()
                                    }else{  
                                        console.log("Loan Ref#: " + e.refno + " Borrower: " + e.member_id.fullname + " Days: " + days )
                                        defaultLoans.push(e)
                                        next()
                                    }                                    
                                }else{
                                    console.log("Not found in PF: ")                                                              
                                    next()
                                }      

                            }).catch((err) => {
                                next()
                            })                          
                        }else{
                            next()
                        }                       
                      
                    }, function () {
                        console.log("Total default loans: " + defaultLoans.length)
                        resolve()
                    })                  
                })
            })
        }

        const getPMLPrice= function(){
            return new Promise(function(resolve, reject) {          
                pullPMLPrice((price)=>{                
                    pmlprice = price
                    resolve()
                })    
            })
        }            

          const getPFIPrice= function(){
            return new Promise(function(resolve, reject) {          
                pullPFIPrice((price)=>{                
                    pfiprice = price
                    resolve()
                })    
            })
        }     

        const getPFBPrice= function(){
            return new Promise(function(resolve, reject) {          
                pullPFBPrice((price)=>{                
                    pfbprice = price
                    resolve()
                })    
            })
        }

        const getPFSPrice= function(){
            return new Promise(function(resolve, reject) {          
                pullPFSPrice((price)=>{                
                    pfsprice = price
                    resolve()
                })    
            })
        }

        const getPFGPrice= function(){
            return new Promise(function(resolve, reject) {          
                pullPFGPrice((price)=>{                
                    pfgprice = price
                    resolve()
                })    
            })
        }

        const iterateDefaultLoans = function(){
            return new Promise(function(resolve, reject){   
                    let totalpml = 0
                    let totalpfi = 0
                    let totalpfs = 0
                    let totalpfb = 0
                    let totalpfg = 0

                    let countpml = 0
                    let countpfi = 0
                    let countpfs = 0
                    let countpfb = 0
                    let countpfg = 0       
                    async.eachSeries(defaultLoans, function (e, next) {                     
                        
                        // console.log("Loan Ref#: " + e.refno + " Borrower: " + e.member_id.fullname + " address: " + e.member_id.walletaddress)
                        // next()

                        autoPayBack(e, pmlprice, pfiprice, pfbprice, pfsprice, pfgprice,  function(retType){
                            if (retType.collateraltype == 1) {
                                countpml += 1
                                totalpml += Number(retType.amount)
                            }else if (retType.collateraltype==0 && retType.cointtype == 0) {
                                countpfi += 1
                                totalpfi += Number(retType.amount)
                            }else if (retType.collateraltype==0 && retType.cointtype == 1) {
                                countpfb += 1
                                totalpfb += Number(retType.amount)
                            }else if (retType.collateraltype==0 && retType.cointtype == 2) {
                                countpfs += 1
                                totalpfs += Number(retType.amount)                   
                            }else if (retType.collateraltype==0 && retType.cointtype == 3) {
                                countpfg += 1
                                totalpfg += Number(retType.amount)
                            }   
                            next()
                        })
                        
                        
                    }, function () {
                        console.log("Total PML collateral needed: " + countpml + " (" + roundToTwo(totalpml) + " PML)")
                        console.log("Total PFI collateral needed: " + countpfi + " (" + roundToTwo(totalpfi) + " PFI)")
                        console.log("Total PFB collateral needed: " + countpfb + " (" + roundToTwo(totalpfb) + " PFB)")
                        console.log("Total PFS collateral needed: " + countpfs + " (" + roundToTwo(totalpfs) + " PFS)")
                        console.log("Total PFG collateral needed: " + countpfg + " (" + roundToTwo(totalpfg) + " PFG)")
                        console.log("Total default loans: " + defaultLoans.length)        
                        resolve()
                    })    

            })
        }

        getDefaultLoans()    
        .then(getPMLPrice)
        .then(getPFIPrice)
        .then(getPFBPrice)
        .then(getPFSPrice)
        .then(getPFGPrice)
        .then(iterateDefaultLoans)   
        .then(function () {
            console.log("Done")
        })
        .catch(function(err){
            console.log(err)            
        })

    }

    this.updateAccessFee = async function () {        
        
        let memb = []
        let counter = 0

        const getMmbers= function(){
            return new Promise(function(resolve, reject) {          
                Member.find({hasaaccessfee: true})
                .then((result) => {
                    memb = result
                    resolve()
                })
            })
        }

        const iterate= function(){
            return new Promise(function(resolve, reject) {          
                async.eachSeries(memb, function (e, next) {                                        
                   Accessfee.find({member_id: e._id})
                   .then((result) => {
                     
                        if (result.length>0){
                          
                            let af = result[result.length-1]                                                        
                            var now = moment(new Date())
                            var datel = moment(af.transdate)
                            var duration = moment.duration(now.diff(datel));
                            var days = duration.asDays();
                            console.log(e.fullname + " -- " + days)
                            if (days>=30){
                                counter = counter + 1
                                Member.findByIdAndUpdate(e._id, {hasaaccessfee: false})
                                .then((result) => {
                                    next()
                                })
                            }else{
                                next()
                            }                        
                        }else{
                            next()
                        }
                        
                   })                  
                }, function () {
                    resolve()
                })    
            })
        }

        getMmbers()    
        .then(iterate)        
        .then(function () {
            console.log("Done " + memb.length + " - " + counter)
        })
        .catch(function(err){
            console.log(err)            
        })


    }


    this.updateWhitelist = async function () {      

        const wl = require("./wl.json")

        await Whitelist.deleteMany({})

        for (const w of wl) {
            let params = {
                member_id: w.member_id ? new ObjectId(w.member_id) : null,
                walletaddress: w.walletaddress,
                status: w.status
            }
            let nw = new Whitelist(params)
            await nw.save()
            console.log("Added to whitelist: " + w.walletaddress)
        }

    }


     this.generateBatchWhitelist = async function () {      

        const wl = require("./wl.json")

        let whitelistEntries = []

        for (const w of wl) {
            let params = {                
                useraddress: w.walletaddress,
                bstat: true
            }
            whitelistEntries.push(params)
        }
        try {
            const jsonData = JSON.stringify(whitelistEntries, null, 2);
            fs.writeFileSync('./whitelist_entries.json', jsonData, 'utf8');
            console.log(`Saved ${whitelistEntries.length} whitelist entries to whitelist_entries.json`);
        } catch (error) {
            console.error('Error saving whitelist entries to JSON:', error);
        }
    }

    this.cancelOffers = async function () {      

        // let result = await Offer.find({member_id: "689eca8c5858ddb1dd8052a7", status: 0}).populate("member_id")

        let result = await Offer.find({status: 0}).populate("member_id")

        let suspended = _.filter(result, (o) => o.member_id.status == 1)

        console.log("Total open offers: " + result.length)
        console.log("Total offers to cancel: " + suspended.length)

        for (const offer of suspended) {
            // console.log("Cancelling offer for: " + offer.member_id.fullname + " Ref#: " + offer.refno + " date: " + moment(offer.transdate).format("YYYY-MM-DD"))

            // const PK = process.env.SENDER_PK
            // const cwallet = new ethers.Wallet(PK, customHttpProvider)              
            // const pmlContract = new ethers.Contract(PMLContractConfig.address, PMLContractConfig.abi, customHttpProvider);
            // let pmltokens = 0.00010315924653
            // let amtStr = stripExcessDecimals(pmltokens) 
            // var bgamount = parseEther(amtStr)            
            // let receiver =  offer.member_id.walletaddress          
            // let tx = await pmlContract.connect(cwallet).transfer(receiver, bgamount)            
            // tx.wait(1)        
            // console.log(tx.hash)
            await Offer.findByIdAndDelete(offer._id)
            console.log("Cancelled offer for: " + offer.member_id.fullname + " Ref#: " + offer.refno + " date: " + moment(offer.transdate).format("YYYY-MM-DD")) 
            // break;
        }

        console.log("Done cancelling offers")

    }

    this.saveGcodes = async function () {        

        const g1 = require("./gcodes/6/gcodes_1.json");
        const g2 = require("./gcodes/6/gcodes_2.json");
        const g3 = require("./gcodes/6/gcodes_3.json");
        const g4 = require("./gcodes/6/gcodes_4.json");
        const g5 = require("./gcodes/6/gcodes_5.json");
        const g6 = require("./gcodes/6/gcodes_6.json");
        const g7 = require("./gcodes/6/gcodes_7.json");
        const g8 = require("./gcodes/6/gcodes_8.json");
        const g9 = require("./gcodes/6/gcodes_9.json");
        const g10 = require("./gcodes/6/gcodes_10.json");
        const g11 = require("./gcodes/6/gcodes_11.json");
        const g12 = require("./gcodes/6/gcodes_12.json");
        const g13 = require("./gcodes/6/gcodes_13.json");
        const g14 = require("./gcodes/6/gcodes_14.json");
        const g15 = require("./gcodes/6/gcodes_15.json");
        const g16 = require("./gcodes/6/gcodes_16.json");
        const g17 = require("./gcodes/6/gcodes_17.json");
        const g18 = require("./gcodes/6/gcodes_18.json");
        const g19 = require("./gcodes/6/gcodes_19.json");
        const g20 = require("./gcodes/6/gcodes_20.json");
        const g21 = require("./gcodes/6/gcodes_21.json");
        const g22 = require("./gcodes/6/gcodes_22.json");
        const g23 = require("./gcodes/6/gcodes_23.json");
        const g24 = require("./gcodes/6/gcodes_24.json");
        const g25 = require("./gcodes/6/gcodes_25.json");
        const g26 = require("./gcodes/6/gcodes_26.json");
        const g27 = require("./gcodes/6/gcodes_27.json");
        const g28 = require("./gcodes/6/gcodes_28.json");
        const g29 = require("./gcodes/6/gcodes_29.json");
        const g30 = require("./gcodes/6/gcodes_30.json");
        const g31 = require("./gcodes/6/gcodes_31.json");
        const g32 = require("./gcodes/6/gcodes_32.json");
        const g33 = require("./gcodes/6/gcodes_33.json");
        const g34 = require("./gcodes/6/gcodes_34.json");
        const g35 = require("./gcodes/6/gcodes_35.json");
        const g36 = require("./gcodes/6/gcodes_36.json");
        const g37 = require("./gcodes/6/gcodes_37.json");
        const g38 = require("./gcodes/6/gcodes_38.json");
        const g39 = require("./gcodes/6/gcodes_39.json");
        const g40 = require("./gcodes/6/gcodes_40.json");
        const g41 = require("./gcodes/6/gcodes_41.json");
        const g42 = require("./gcodes/6/gcodes_42.json");
        const g43 = require("./gcodes/6/gcodes_43.json");
        const g44 = require("./gcodes/6/gcodes_44.json");
        const g45 = require("./gcodes/6/gcodes_45.json");
        const g46 = require("./gcodes/6/gcodes_46.json");
        const g47 = require("./gcodes/6/gcodes_47.json");
        const g48 = require("./gcodes/6/gcodes_48.json");
        const g49 = require("./gcodes/6/gcodes_49.json");
        const g50 = require("./gcodes/6/gcodes_50.json");
        

        const lists = [].concat(g1, g2, g3, g4, g5, g6, g7, g8, g9, g10, g11, g12, g13, g14, g15, g16, g17, g18, g19, g20, g21, g22, g23, g24, g25, g26, g27, g28, g29, g30, g31, g32, g33, g34, g35, g36, g37, g38, g39, g40, g41, g42, g43, g44, g45, g46, g47, g48, g49, g50)

        let insertParams = []
        
        lists.forEach(code => {           
            insertParams.push({
                id: code.id,
                code: code.code,
                used: false
            })
        })
        
        await Gcode.insertMany(insertParams)
        
        console.log("Gcodes inserted successfully! Total codes to insert: " + insertParams.length)
      
    }


    this.checkGCodes = async function () {        

        const PK =  process.env.OWNER_PK
        const cwallet = new ethers.Wallet(PK, customHttpProvider)              
        const wpContract = new ethers.Contract(GuaranteeContractConfig.address, GuaranteeContractConfig.abi, customHttpProvider);

        let gccodes = await Gcode.find()
        
        let ctr = 0
        let usedCtr = 0
        for (const gc of gccodes) {
            let isused = await wpContract.connect(cwallet).getSwapCode(gc.code)     
            console.log(isused[2])
            console.log("Gcode: " + gc.code + " isused: " + isused[2])
            if (isused[2]){
                usedCtr = usedCtr + 1
            }
            ctr = ctr + 1            
        }

        const filterUsed = gccodes.filter(g => g.used)
        console.log("Total used Gcodes in DB: " + filterUsed.length )

        console.log("Total DB:" + gccodes.length + ", Total Gcodes checked: " + ctr + " Used codes: " + usedCtr)



    }

    async function autoPayBack(data, pmlprice, pfiprice, pfbprice, pfsprice, pfgprice, cb) {
            
        let retType = {
            collateraltype: 0,
            cointtype: 0,
            amount: 0
        }   
        if (data.member_id.collateralpayment==1){
            // console.log("Loan Ref#: " + data.refno + " Lender: " + data.member_id.fullname + "(" + data.member_id.walletaddress + ")  Borrower: " + data.borrower_id.fullname + "(" + data.borrower_id.walletaddress + ") Date Loaned: " + moment(data.borrowed_at).format("YYYY-MM-DD")  + " payme: " + data.member_id.collateralpayment)       
            retType.collateraltype = 1
            retType.amount =  100 / pmlprice
            console.log("pml -> " + retType.amount)            
            sendPMLTokens(data, pmlprice,  function(txhash){               
                let params = {
                    status: 2,
                    ispaid: true,
                    pay_pml_txhash: txhash,                          
                    paid_at: moment().toDate()       
                }
                Offer.findByIdAndUpdate(data._id, params)
                .then(()=>{
                   cb(retType)
                })                    
            })
            
            // cb()
        }else if (data.member_id.collateralpayment==0){
            
            if (data.collateral_token_type==3) {
                // PFG                          
                retType.collateraltype = 0
                retType.cointtype = 3
                retType.amount =  100 / pfgprice      
                console.log("pfg -> " + retType.amount)                
                sendPFGTokens(data, pfgprice,  function(txhash){               
                    let params = {
                        status: 2,
                        ispaid: true,
                        pay_pml_txhash: txhash,               
                        paid_at: moment().toDate()       
                    }
                    Offer.findByIdAndUpdate(data._id, params)
                    .then(()=>{
                        cb(retType)
                    })                       
                })      
            }else if (data.collateral_token_type==2) {
                // PFS
                // console.log("PFS")
                retType.collateraltype = 0
                retType.cointtype = 2
                retType.amount =  100 / pfsprice      
                console.log("pfs -> " + retType.amount)     
                sendPFSTokens(data, pfsprice,  function(txhash){               
                    let params = {
                        status: 2,
                        ispaid: true,
                        pay_pml_txhash: txhash,               
                        paid_at: moment().toDate()       
                    }
                    Offer.findByIdAndUpdate(data._id, params)
                    .then(()=>{
                        cb(retType)
                    })                
                })      
            }else if (data.collateral_token_type==1) {
                retType.collateraltype = 0
                retType.cointtype = 1
                retType.amount =  100 / pfbprice      
                console.log("pfb -> " + retType.amount)     
                sendPFBTokens(data, pfbprice,  function(txhash){               
                    let params = {
                        status: 2,
                        ispaid: true,
                        pay_pml_txhash: txhash,               
                        paid_at: moment().toDate()       
                    }
                    Offer.findByIdAndUpdate(data._id, params)
                    .then(()=>{
                        cb(retType)
                    })                
                })      
            }else if (data.collateral_token_type==0) {
                // PFI
                retType.collateraltype = 0
                retType.cointtype = 0
                retType.amount =  100 / pfiprice      
                console.log("pfi -> " + retType.amount)     
                sendPFITokens(data, pfiprice,  function(txhash){   
                    // cb()            
                    let params = {
                        status: 2,
                        ispaid: true,
                        pay_pml_txhash: txhash,                            
                        paid_at: moment().toDate()       
                    }
                    Offer.findByIdAndUpdate(data._id, params)
                    .then(()=>{
                        cb(retType)
                    })                
                })          
               
            }else{
                 console.log("----------------none-----------")
                cb(retType)        
            }                              
        }else{
            cb(retType)
        }      
    }

    async function sendPMLTokens(data, pmlprice, cb) {

        // console.log("sendPMLTokens.....")
        // cb("hash")
        const PK = process.env.SENDER_PK
        const cwallet = new ethers.Wallet(PK, customHttpProvider)              
        const pmlContract = new ethers.Contract(PMLContractConfig.address, PMLContractConfig.abi, customHttpProvider);
                 
        let pmltokens =  100 / pmlprice   
        // console.log("pml tokens: " + pmltokens)             
        console.log("Loan Ref#: " + data.refno + " Lender: " + data.member_id.fullname + "(" + data.member_id.walletaddress + ")")  
        // cb("")
        let amtStr = stripExcessDecimals(pmltokens)           
        if (Number(amtStr) > 0) {
            var bgamount = parseEther(amtStr)
            // console.log(bgamount)            
            // data.member_id.walletaddress  
            let receiver = data.member_id.walletaddress 
            //"0xc5Ee5EDe4DbE219eB0FB8b11F2953A9149350725"
            //data.member_id.walletaddress          
            pmlContract.connect(cwallet).transfer(receiver, bgamount)
            .then((tx)=>{
                tx.wait(1)
                .then((receipt)=>{
                    // console.log(receipt.hash)                  
                    cb(receipt.hash)                            
                })
                .catch((err)=>{
                    console.log(err)                            
                    cb("")
                })                       
            })
            .catch((err)=>{
                console.log(err)                       
                cb("")
            })                    
        } else {
            cb("")
        }       
    }

     
    async function pullPMLPrice(cb){

        console.log("pullPMLPrice")
        try {

            function sqrtPriceX96ToPrice(sqrtPriceX96, decimals0, decimals1) {
                const sqrt = BigInt(sqrtPriceX96);
                const numerator = sqrt * sqrt * 10n ** BigInt(decimals0);
                const denominator = 2n ** 192n * 10n ** BigInt(decimals1);
                return Number(numerator) / Number(denominator);
            }

            let PAIRAD = "0xbc71c602fbf4dc37d5cad1169fb7de494e4d73a4"
        
            const poolAbi = [
                "function slot0() external view returns (uint160 sqrtPriceX96,int24 tick,int24,uint16,uint16,uint8,bool)",
                "function token0() external view returns (address)",
                "function token1() external view returns (address)"
            ];

            const USDTADDR = process.env.USDTADDR
            const PMLADDR = process.env.PMLADDR
            const USDT = USDTADDR.toLowerCase();
            const PML  = PMLADDR.toLowerCase();
        
            const decimals = {           
                [USDT]: 18,
                [PML]: 18
            };

            const pool = new ethers.Contract(PAIRAD, poolAbi, customHttpProvider);

            const [slot0, token0, token1] = await Promise.all([
                pool.slot0(),
                pool.token0(),
                pool.token1()
            ]);

            const sqrtPriceX96 = slot0.sqrtPriceX96.toString();
            const token0Addr = token0.toLowerCase();
            const token1Addr = token1.toLowerCase();

            const dec0 = decimals[token0Addr];
            const dec1 = decimals[token1Addr];

            let price = sqrtPriceX96ToPrice(sqrtPriceX96, dec0, dec1);

            // console.log(`Token0: ${token0Addr}, Token1: ${token1Addr}`);
            // console.log(`Price: ${price}`);
            
            if (token1Addr === PML) {
                price = 1 / price;
                // console.log(`1 PML ≈ ${price.toFixed(6)} USDT 1`);
            }else{
                // console.log(`1 PML ≈ ${price.toFixed(6)} USDT 2`);
            }
        
            // console.log("p1:", price)
            cb(price)
            // let price = 45309.7842
        
        
        }catch(err){
            console.log(err)
            cb(0)
        }


    }

    async function pullPFBPrice(cb){

        // console.log("pullPFBPrice")
        try {
            let PAIRAD = "0x09f8bc3b4bdc152fcd8894515dd4a95bd3dca26e"        
            const USDTADDR = process.env.USDTADDR
            
            const pairContract = new ethers.Contract(PAIRAD, pairCon.abi, customHttpProvider)    
        
            const reserves = await pairContract.getReserves()
            const reserve0 = reserves.reserve0;
            const reserve1 = reserves.reserve1;

            const token0 = await pairContract.token0()
            const token1 = await pairContract.token1()           
            let price;
            if (token0.toLowerCase() === USDTADDR.toLowerCase()) {
            // USDT is token0, price is reserve0 / reserve1
                price = reserve0 / reserve1;
            } else {
            // USDT is token1, price is reserve1 / reserve0
                price = reserve1 / reserve0;
            }
                
            price = roundToTwo(price)

            cb(price)

        }catch(err){
            console.log(err)
            cb(0)
        }


    }

    async function pullPFIPrice(cb){

        // console.log("pullPFBPrice")
        try {
            let PAIRAD = "0x8d9e2252d28715C0f9A448288D2A09a47E794996"        
            const USDTADDR = process.env.USDTADDR
            
            const pairContract = new ethers.Contract(PAIRAD, pairCon.abi, customHttpProvider)    
        
            const reserves = await pairContract.getReserves()
            const reserve0 = reserves.reserve0;
            const reserve1 = reserves.reserve1;

            const token0 = await pairContract.token0()
            const token1 = await pairContract.token1()           
            let price;
            if (token0.toLowerCase() === USDTADDR.toLowerCase()) {
            // USDT is token0, price is reserve0 / reserve1
                price = reserve0 / reserve1;
            } else {
            // USDT is token1, price is reserve1 / reserve0
                price = reserve1 / reserve0;
            }
                
            price = roundToTwo(price)

            cb(price)

        }catch(err){
            console.log(err)
            cb(0)
        }
    }

    async function sendPFBTokens(data, pfbprice, cb) {

        // console.log("sendPFBTokens.....")                        
        let tokens = stripExcessDecimals(data.collateral_token)         
        let currenttokenprice = Number(tokens) * pfbprice        
        let toreceive = 0
        if (currenttokenprice>=100){
            toreceive = Number(tokens)
        }else{
            toreceive =  100 / pfbprice                   
        }
        // console.log("to receive: " + toreceive)     
        // cb("")

        const PK = process.env.SENDER_PK
        const cwallet = new ethers.Wallet(PK, customHttpProvider)              
        const pfbContract = new ethers.Contract(PFBContractConfig.address, PFBContractConfig.abi, customHttpProvider);
                         
        let amtStr = stripExcessDecimals(toreceive)           
        if (Number(amtStr) > 0) {
            var bgamount = parseEther(amtStr)
            // console.log(bgamount)            
            // data.member_id.walletaddress  
            let receiver = data.member_id.walletaddress              
            // "0xc5Ee5EDe4DbE219eB0FB8b11F2953A9149350725"
            //data.member_id.walletaddress          
            pfbContract.connect(cwallet).transfer(receiver, bgamount)
            .then((tx)=>{
                tx.wait(1)
                .then((receipt)=>{
                    // console.log(receipt.hash)
                    // console.log("Loan Ref#: " + data.refno + " Lender: " + data.member_id.fullname + "(" + data.member_id.walletaddress + ")  Borrower: " + data.borrower_id.fullname + "(" + data.borrower_id.walletaddress + ") Date Loaned: " + moment(data.borrowed_at).format("YYYY-MM-DD")  + " payme: " + data.member_id.collateralpayment)
                    cb(receipt.hash)                            
                })
                .catch((err)=>{
                    console.log(err)                            
                    cb("")
                })                       
            })
            .catch((err)=>{
                console.log(err)                       
                cb("")
            })                    
        } else {
            cb("")
        }   
    }

    async function sendPFITokens(data, pfiprice, cb) {

        // console.log("sendPFITokens.....")                        
        let tokens = stripExcessDecimals(data.collateral_token)           
        let currenttokenprice = Number(tokens) * pfiprice        
        let toreceive = 0                
        if (currenttokenprice>=100){
            toreceive = Number(tokens)
        }else{
            toreceive =  100 / pfiprice                   
        }
        // console.log("current token: " + tokens)     
        // console.log("to receive: " + toreceive)     
        // cb("")
        const PK = process.env.SENDER_PK
        const cwallet = new ethers.Wallet(PK, customHttpProvider)              
        const pfbContract = new ethers.Contract(PFIContractConfig.address, PFIContractConfig.abi, customHttpProvider);
                         
        let amtStr = stripExcessDecimals(toreceive)   
              
        if (Number(amtStr) > 0) {
            var bgamount = parseEther(amtStr)
            // console.log(bgamount)            
            // data.member_id.walletaddress  
            let receiver = data.member_id.walletaddress          
            //"0xc5Ee5EDe4DbE219eB0FB8b11F2953A9149350725"            
            pfbContract.connect(cwallet).transfer(receiver, bgamount)
            .then((tx)=>{
                tx.wait(1)
                .then((receipt)=>{
                    // console.log(receipt.hash)
                    // console.log("Loan Ref#: " + data.refno + " Lender: " + data.member_id.fullname + "(" + data.member_id.walletaddress + ")  Borrower: " + data.borrower_id.fullname + "(" + data.borrower_id.walletaddress + ") Date Loaned: " + moment(data.borrowed_at).format("YYYY-MM-DD")  + " payme: " + data.member_id.collateralpayment)
                    cb(receipt.hash)                            
                })
                .catch((err)=>{
                    console.log(err)                            
                    cb("")
                })                       
            })
            .catch((err)=>{
                console.log(err)                       
                cb("")
            })                    
        } else {
            cb("")
        }   
    }

    async function pullPFSPrice(cb){

        // console.log("pullPFBPrice")
        try {
            let PAIRAD = "0xfa01cb55a68380e2d5c66a70e4e728fc6277feb2"        
            const USDTADDR = process.env.USDTADDR
            
            const pairContract = new ethers.Contract(PAIRAD, pairCon.abi, customHttpProvider)    
        
            const reserves = await pairContract.getReserves()
            const reserve0 = reserves.reserve0;
            const reserve1 = reserves.reserve1;

            const token0 = await pairContract.token0()
            const token1 = await pairContract.token1()           
            let price;
            if (token0.toLowerCase() === USDTADDR.toLowerCase()) {
            // USDT is token0, price is reserve0 / reserve1
                price = reserve0 / reserve1;
            } else {
            // USDT is token1, price is reserve1 / reserve0
                price = reserve1 / reserve0;
            }
                
            price = roundToTwo(price)

            cb(price)

        }catch(err){
            console.log(err)
            cb(0)
        }


    }

    async function sendPFSTokens(data, pfbprice, cb) {

        // console.log("sendPFSTokens.....")                        
        let tokens = stripExcessDecimals(data.collateral_token)         
        let currenttokenprice = Number(tokens) * pfbprice        
        let toreceive = 0
        if (currenttokenprice>=100){
            toreceive = Number(tokens)
        }else{
            toreceive =  100 / pfbprice                   
        }
        // cb("")
        // console.log("to receive: " + toreceive)     
        
        const PK = process.env.SENDER_PK
        const cwallet = new ethers.Wallet(PK, customHttpProvider)              
        const pfbContract = new ethers.Contract(PFSContractConfig.address, PFSContractConfig.abi, customHttpProvider);
                         
        let amtStr = stripExcessDecimals(toreceive)           
        if (Number(amtStr) > 0) {
            var bgamount = parseEther(amtStr)
            // console.log(bgamount)            
            // data.member_id.walletaddress  
            let receiver = data.member_id.walletaddress              
            // "0xc5Ee5EDe4DbE219eB0FB8b11F2953A9149350725"
            //data.member_id.walletaddress          
            pfbContract.connect(cwallet).transfer(receiver, bgamount)
            .then((tx)=>{
                tx.wait(1)
                .then((receipt)=>{
                    // console.log(receipt.hash)
                    // console.log("Loan Ref#: " + data.refno + " Lender: " + data.member_id.fullname + "(" + data.member_id.walletaddress + ")  Borrower: " + data.borrower_id.fullname + "(" + data.borrower_id.walletaddress + ") Date Loaned: " + moment(data.borrowed_at).format("YYYY-MM-DD")  + " payme: " + data.member_id.collateralpayment)
                    cb(receipt.hash)                            
                })
                .catch((err)=>{
                    console.log(err)                            
                    cb("")
                })                       
            })
            .catch((err)=>{
                console.log(err)                       
                cb("")
            })                    
        } else {
            cb("")
        }   
       
    }
   
    async function pullPFGPrice(cb){

        // console.log("pullPFBPrice")
        try {
            let PAIRAD = "0xd36fa2412cae6db25dfbc6348d5e4cdd9665ad4b"        
            const USDTADDR = process.env.USDTADDR
            
            const pairContract = new ethers.Contract(PAIRAD, pairCon.abi, customHttpProvider)    
        
            const reserves = await pairContract.getReserves()
            const reserve0 = reserves.reserve0;
            const reserve1 = reserves.reserve1;

            const token0 = await pairContract.token0()
            const token1 = await pairContract.token1()           
            let price;
            if (token0.toLowerCase() === USDTADDR.toLowerCase()) {
            // USDT is token0, price is reserve0 / reserve1
                price = reserve0 / reserve1;
            } else {
            // USDT is token1, price is reserve1 / reserve0
                price = reserve1 / reserve0;
            }
                
            price = roundToTwo(price)

            cb(price)

        }catch(err){
            console.log(err)
            cb(0)
        }
    }

    async function sendPFGTokens(data, pfbprice, cb) {

        // console.log("sendPFGTokens.....")                        
        let tokens = stripExcessDecimals(data.collateral_token)         
        let currenttokenprice = Number(tokens) * pfbprice        
        let toreceive = 0
        if (currenttokenprice>=100){
            toreceive = Number(tokens)
        }else{
            toreceive =  100 / pfbprice                   
        }
        // cb("")
        // toreceive = 0.00001
        // console.log("to receive: " + toreceive)     
        
        const PK = process.env.SENDER_PK
        const cwallet = new ethers.Wallet(PK, customHttpProvider)              
        const pfbContract = new ethers.Contract(PFGContractConfig.address, PFGContractConfig.abi, customHttpProvider);
                         
        let amtStr = stripExcessDecimals(toreceive)           
        if (Number(amtStr) > 0) {
            var bgamount = parseEther(amtStr)
            // console.log(bgamount)            
            // data.member_id.walletaddress  
            let receiver =  data.member_id.walletaddress
            // data.member_id.walletaddress              
            // "0xE8e4B893eF7A215E6Fb7D86155deE4e4e49d9789"
            //data.member_id.walletaddress          
            pfbContract.connect(cwallet).transfer(receiver, bgamount)
            .then((tx)=>{
                tx.wait(1)
                .then((receipt)=>{
                    // console.log(receipt.hash)
                    // console.log("Loan Ref#: " + data.refno + " Lender: " + data.member_id.fullname + "(" + data.member_id.walletaddress + ")  Borrower: " + data.borrower_id.fullname + "(" + data.borrower_id.walletaddress + ") Date Loaned: " + moment(data.borrowed_at).format("YYYY-MM-DD")  + " payme: " + data.member_id.collateralpayment)
                    cb(receipt.hash)                            
                })
                .catch((err)=>{
                    console.log(err)                            
                    cb("")
                })                       
            })
            .catch((err)=>{
                console.log(err)                       
                cb("")
            })                    
        } else {
            cb("")
        }   
       
    }

    this.updateSuspended = async function () {        

        let members =  await Member.find()

        let suspendedCount = 0
        let notfound = 0
     
        for (const e of members) {               
            let url = "https://poolfunding.io/api/check-status/"+ e.walletaddress          
            let res = await axios.get(url)
            if (res.data && res.data.status == 1) {                              
                if (res.data.data && res.data.data.isSuspended) {
                    console.log("Suspended in PF: " + e.walletaddress)    
                    suspendedCount = suspendedCount + 1           
                    await Member.findByIdAndUpdate(e._id, {status: 1, date_suspended: new Date()})                                                                                                                                                      
                }
            }else{
                console.log("Not found in PF: " + e.walletaddress)      
                notfound = notfound + 1    
                await Member.findByIdAndUpdate(e._id, {status: 1, date_suspended: new Date()})                                                         
            }    
        }

        console.log("Total suspended: " + suspendedCount + ", Not found: " + notfound)
        console.log("Total members: " + members.length)
    }
}



module.exports = new Job()


