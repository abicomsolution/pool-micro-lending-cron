const Member = require("./models/member")
const Offer = require("./models/offer")
const Accessfee = require("./models/accessfee")
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


      this.updateRebates= async function () {        

        let loanoffers = []
        let pmlprice = 0

        const getSixtyDaysLoans= function(){
            return new Promise(function(resolve, reject) {          
                Offer.find({ispaid: true, hasRebate: false})
                .populate("member_id")              
                .populate("borrower_id")        
                .then((result) => {

                    console.log("Total paid loans: " + result.length)            

                    async.eachSeries(result, function (e, next) {
                     
                        var now = moment(new Date())
                        var datel = moment(e.borrowed_at)
                        var duration = moment.duration(now.diff(datel));
                        var days = duration.asDays();
                        // console.log("Loan Ref#: " + e.refno + " Borrower: " + e.member_id.fullname + " Days: " + days + " Date Loaned: " + moment(e.borrowed_at).format("YYYY-MM-DD") )
                        if (days>=60) {
                           loanoffers.push(e)
                        }

                        next()
                    }, function () {
                        console.log("Total 60 days loans: " + loanoffers.length)
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
                        // console.log("Loan Ref#: " + e.refno + " Borrower: " + e.member_id.fullname + " Days: " + days + " Date Loaned: " + moment(e.borrowed_at).format("YYYY-MM-DD") )
                        if (days>=30) {
                           defaultLoans.push(e)
                        }

                        next()
                    }, function () {
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

        const iterateDefaultLoans = function(){
            return new Promise(function(resolve, reject){          
                    async.eachSeries(defaultLoans, function (e, next) {                     
                        
                        // console.log("Loan Ref#: " + e.refno + " Borrower: " + e.member_id.fullname + " address: " + e.member_id.walletaddress)
                        // next()
                        
                        autoPayBack(e, pmlprice, function(){
                            next()
                        })
                        
                        
                    }, function () {
                        resolve()
                    })    

            })
        }

        getDefaultLoans()    
        .then(getPMLPrice)
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

    async function autoPayBack(data, pmlprice, cb) {
            
        // console.log(PMLContractConfig.abi)        
        // cb()     
        if (data.member_id.collateralpayment==1){
            // console.log("Loan Ref#: " + data.refno + " Lender: " + data.member_id.fullname + "(" + data.member_id.walletaddress + ")  Borrower: " + data.borrower_id.fullname + "(" + data.borrower_id.walletaddress + ") Date Loaned: " + moment(data.borrowed_at).format("YYYY-MM-DD")  + " payme: " + data.member_id.collateralpayment)
            console.log("--pml--")
            sendPMLTokens(data, pmlprice,  function(txhash){               
                let params = {
                    status: 2,
                    ispaid: true,
                    pay_pml_txhash: txhash,                          
                    paid_at: moment().toDate()       
                }
                Offer.findByIdAndUpdate(data._id, params)
                .then(()=>{
                    cb()
                })                    
            })
            
            // cb()
        }else if (data.member_id.collateralpayment==0){
            
            if (data.collateral_token_type==3) {
                // PFG
                console.log("PFG")
                //  cb() 
                 // console.log("Loan Ref#: " + data.refno + " Lender: " + data.member_id.fullname + "(" + data.member_id.walletaddress + ")  Borrower: " + data.borrower_id.fullname + "(" + data.borrower_id.walletaddress + ") Date Loaned: " + moment(data.borrowed_at).format("YYYY-MM-DD")  + " payme: " + data.member_id.collateralpayment)
                pullPFGPrice((price)=>{    
                    // console.log(price)               
                    //  cb()
                    sendPFGTokens(data, price,  function(txhash){               
                        let params = {
                            status: 2,
                            ispaid: true,
                             pay_pml_txhash: txhash,               
                            paid_at: moment().toDate()       
                        }
                        Offer.findByIdAndUpdate(data._id, params)
                        .then(()=>{
                            cb()
                        })   
                        // cb()             
                    })                    
                })
            }else if (data.collateral_token_type==2) {
                // PFS
                console.log("PFS")
                // cb() 
                // console.log("Loan Ref#: " + data.refno + " Lender: " + data.member_id.fullname + "(" + data.member_id.walletaddress + ")  Borrower: " + data.borrower_id.fullname + "(" + data.borrower_id.walletaddress + ") Date Loaned: " + moment(data.borrowed_at).format("YYYY-MM-DD")  + " payme: " + data.member_id.collateralpayment)
                pullPFSPrice((price)=>{    
                    // console.log(price)               
                    //  cb()
                    sendPFSTokens(data, price,  function(txhash){               
                        let params = {
                            status: 2,
                            ispaid: true,
                             pay_pml_txhash: txhash,               
                            paid_at: moment().toDate()       
                        }
                        Offer.findByIdAndUpdate(data._id, params)
                        .then(()=>{
                            cb()
                        })                
                    })                    
                })
            }else if (data.collateral_token_type==1) {
                console.log("PFB")
                // cb() 
                // PFB
                pullPFBPrice((price)=>{                   
                    sendPFBTokens(data, price,  function(txhash){               
                        let params = {
                            status: 2,
                            ispaid: true,
                             pay_pml_txhash: txhash,               
                            paid_at: moment().toDate()       
                        }
                        Offer.findByIdAndUpdate(data._id, params)
                        .then(()=>{
                            cb()
                        })                
                    })                    
                })
            }else if (data.collateral_token_type==0) {
                // PFI
                console.log("PFI")
                // cb()
                pullPFIPrice((price)=>{                   
                    sendPFITokens(data, price,  function(txhash){   
                        // cb()            
                        let params = {
                            status: 2,
                            ispaid: true,
                            pay_pml_txhash: txhash,                            
                            paid_at: moment().toDate()       
                        }
                        Offer.findByIdAndUpdate(data._id, params)
                        .then(()=>{
                            cb()
                        })                
                    })                    
                }) 
            }else{
                 console.log("----------------none-----------")
                cb()        
            }                              
        }else{
            cb()
        }      
    }

    async function sendPMLTokens(data, pmlprice, cb) {

        // console.log("sendPMLTokens.....")
        // cb("hash")
        const PK = process.env.SENDER_PK
        const cwallet = new ethers.Wallet(PK, customHttpProvider)              
        const pmlContract = new ethers.Contract(PMLContractConfig.address, PMLContractConfig.abi, customHttpProvider);
                 
        let pmltokens =  100 / pmlprice                
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
                    console.log("Loan Ref#: " + data.refno + " Lender: " + data.member_id.fullname + "(" + data.member_id.walletaddress + ")  Borrower: " + data.borrower_id.fullname + "(" + data.borrower_id.walletaddress + ") Date Loaned: " + moment(data.borrowed_at).format("YYYY-MM-DD")  + " payme: " + data.member_id.collateralpayment)
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

        // pmlContract.balanceOf(process.env.SENDER_FUND_ADDR)
        // .then((pmlBalance)=>{
                                                      
        // }).catch((err)=>{
        //     // console.log(err)
        //     console.log("e3")
        //     cb("")
        // })

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

        console.log("sendPFBTokens.....")                        
        let tokens = stripExcessDecimals(data.collateral_token)         
        let currenttokenprice = Number(tokens) * pfbprice        
        let toreceive = 0
        if (currenttokenprice>=100){
            toreceive = Number(tokens)
        }else{
            toreceive =  100 / pfbprice                   
        }
        console.log("to receive: " + toreceive)     
        
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
                    console.log("Loan Ref#: " + data.refno + " Lender: " + data.member_id.fullname + "(" + data.member_id.walletaddress + ")  Borrower: " + data.borrower_id.fullname + "(" + data.borrower_id.walletaddress + ") Date Loaned: " + moment(data.borrowed_at).format("YYYY-MM-DD")  + " payme: " + data.member_id.collateralpayment)
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

        console.log("sendPFITokens.....")                        
        let tokens = stripExcessDecimals(data.collateral_token)     
        console.log("pfi price: " + pfiprice)    
        let currenttokenprice = Number(tokens) * pfiprice        
        let toreceive = 0                
        if (currenttokenprice>=100){
            toreceive = Number(tokens)
        }else{
            toreceive =  100 / pfiprice                   
        }
        console.log("current token: " + tokens)     
        console.log("to receive: " + toreceive)     
        
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
                    console.log("Loan Ref#: " + data.refno + " Lender: " + data.member_id.fullname + "(" + data.member_id.walletaddress + ")  Borrower: " + data.borrower_id.fullname + "(" + data.borrower_id.walletaddress + ") Date Loaned: " + moment(data.borrowed_at).format("YYYY-MM-DD")  + " payme: " + data.member_id.collateralpayment)
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

        console.log("sendPFSTokens.....")                        
        let tokens = stripExcessDecimals(data.collateral_token)         
        let currenttokenprice = Number(tokens) * pfbprice        
        let toreceive = 0
        if (currenttokenprice>=100){
            toreceive = Number(tokens)
        }else{
            toreceive =  100 / pfbprice                   
        }
        console.log("to receive: " + toreceive)     
        
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
                    console.log("Loan Ref#: " + data.refno + " Lender: " + data.member_id.fullname + "(" + data.member_id.walletaddress + ")  Borrower: " + data.borrower_id.fullname + "(" + data.borrower_id.walletaddress + ") Date Loaned: " + moment(data.borrowed_at).format("YYYY-MM-DD")  + " payme: " + data.member_id.collateralpayment)
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

        console.log("sendPFGTokens.....")                        
        let tokens = stripExcessDecimals(data.collateral_token)         
        let currenttokenprice = Number(tokens) * pfbprice        
        let toreceive = 0
        if (currenttokenprice>=100){
            toreceive = Number(tokens)
        }else{
            toreceive =  100 / pfbprice                   
        }
        toreceive = 0.00001
        console.log("to receive: " + toreceive)     
        
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
                    console.log("Loan Ref#: " + data.refno + " Lender: " + data.member_id.fullname + "(" + data.member_id.walletaddress + ")  Borrower: " + data.borrower_id.fullname + "(" + data.borrower_id.walletaddress + ") Date Loaned: " + moment(data.borrowed_at).format("YYYY-MM-DD")  + " payme: " + data.member_id.collateralpayment)
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

}



module.exports = new Job()


