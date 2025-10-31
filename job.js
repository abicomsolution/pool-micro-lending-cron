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
const { type } = require("os")

var customHttpProvider = new JsonRpcProvider("https://bsc-dataseed.binance.org");

const whitelist = [
  "0x5AE626e240978092EC5Df99F22c1f6D5ff2D6300",
  "0x5Cd9dc9D58952aF212128821cbb2dEf414D5C0c3",
  "0x004ef15fb0614c0976f563f0e14AA1f3dA04a2B8",
  "0x59a9dcD4c767a6B94302B60dE1fb34C533156688",
  "0x2278FF92B4E36F76AE580cF919Ea4622c22B7B59",
  "0x7792Bcc3a0c27f9920AE309fDEa8f31C98987d55",
  "0x4Ad7e1c181eb28FF50467d5Fb7E61aB1c099030C",
  "0x2b68cBc6daBC0955ca9F8982668842F7Bba3814a",
  "0x00B28158d85a7a022aa978d5Ef08eC58dDb9e795",
  "0xF2A405D7730974424d9562c227598c031cc8448E",
  "0x74780484a6c20e0Eda2bfDC3EE252A3c04149E8C",
  "0xDb8C45b33743D51E45Ff8a0d81F82f0d1003B3FC",
  "0x6B1194F21Da30Af78eE570b876eED251ed4c53c2",
  "0xf0a724183D7810f7f17e2f64aD47a416BE962887",
  "0x57276a33D278dbf461476FDa1561df4706118841",
  "0xca7Dd7C52AaEcb17506c1652262c6EB91a3700Ce",
  "0x256107E0038d0D0765ecADCc345DC17d97d3D9eF",
  "0x11Fa6D71c0190Af8b6159ea7e1B87080c5c3383E",
  "0x87556f22fc9C18154fCe49342FD11b16500e3D5a",
  "0x9C80e1dd73A599DD295b10435E5e25D8D8Aeb8C8",
  "0x62b4Ae2FeCd93A71bb2A117F6358A6C9428A34CA",
  "0x910a10b954fF55adDDb9700b3cAd36a6CFCb582f",
  "0x38F7cAE57574f8098f6829F3c45461e5f4a7DD35",
  "0x03F7f08051ce747A7Dc789Fb492706df69A3e232",
  "0xE1DAB6f4ae71A2EDaB4eA3beb8d77a663E51d45a",
  "0xa83e9f1280cbc088d1C95561c04D41f2cF17C872",
  "0xc816C2BBaDd272D7d3822cf6cE7383adb18005bE",
  "0xF085C24d182EFAB7cCF7342aEde9C324EcB88D25",
  "0xfc702ddd70964a66528e25A104c15AaAde555A1B",
  "0x46E280fD1F5d24f31c88a213af6AC5c57B8Ebd49",
  "0xFEA1eA85433566311C28035E389a18877c1B3b6B",
  "0x407C5eBad233038570210EC094F6be49B89F92ad",
  "0x41382680F3C742304F2500e84E0d751bB9f463B3",
  "0x12165B014479704A6e61319E72C4308C6F3D6179",
  "0xe3370207be7185B7Dff71d45D81F35acc6F49f0B",
  "0xe6406750269743fD693c6BD52CE994417C375faC",
  "0x92f2Ce84363d640E827E0f05cf59CF4219eBdD39",
  "0xC7C7870edD645646E7A7cA047E16807A8E0c4C23",
  "0x96D9a8E4bb3026a526876fa8475BD52453a40078",
  "0xf32B728432f0565e0Da5eaeE1e5Fcd0De611f373",
  "0xeDAae0559E0e1Cd398eA2Ab8088DB3Cb77508549",
  "0x9E7F949AA5E5299cf5C8b36f9F9AbEA5E97336db",
  "0x7091f4BC0c2Fb0cC9962Bae6249034EB4448C3C9",
  "0x5D6E0315D028578a85572dCbdA92D9ce15060F49",
  "0xf8dA0A7D6D677992B2007b7cFB644CAB992f7308",
  "0x0546D8FE18E2657e75DAE9F5c8994169c44faFB7",
  "0x24DF7062d7a54bf372537bC1d0186eaFc64219d7",  
  "0x23105e80450Fc01bB0FA7f991315734524a04253",
  "0xF15e37b04f90869bD35484a6BC0B296df2D61F61",
  "0x0Ea4aAa08cFa7970A5aC0D06091a3b079aEF5449",
  "0x96D9a8E4bb3026a526876fa8475BD52453a40078",
  "0xa9DaE17a1091e9A3eef8d94D57614DB9b227D1B5",
  "0xD0a13fF7b246BDC50Cd106ce7ba8267c2d3Eb8a9",
  "0x7F803ab441Ab82A83E11F7c1899dA029bf47A521",
  "0xf32B728432f0565e0Da5eaeE1e5Fcd0De611f373",
  "0x98C904d4F9052729A48e5E34af58257b01f6c913",
  "0xf4251d7FfACC89dd2443753f743B985f80d58508",
  "0xC6b06520c58FE1e631aDece4C16823638f44ebeA",
  "0x1bb2D9380403B9684bAc58D156cCaAa3F0E624A3",
  "0x59a9dcD4c767a6B94302B60dE1fb34C533156688",
  "0x7c93C5288b27fE0C84567262946D523c51090B0D",
  "0xFc2c7304F3F9E1DD5bABA7CfBaAfC6E1494d023a",
  "0x8F45771d4794988EA3097B161e72DD5F822b158f",
  "0xf5758c98619e3b2e6415789600de2e95b40f8b98",
  "0x3aedf51955f2b01b383e214f2e84e202b80b61ad",
  "0xAd96D58af52371249c20aeCC60DC0269Eb2A79d6",
  "0xCfF5c0E651800Fbe1aDBF4D471D0421a595f007a",
  "0x15fd6267E6172fde5Bd3e3C19Af342e003746489"
]

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

    this.runGuarantees = async function () {   

        let whales = []
        let pmlprice = 0
        let pfiprice = 0
        let pfbprice = 0
        let pfsprice = 0
        let pfgprice = 0

        const getWhales = function(){
            return new Promise(function(resolve, reject) {          
                Member.find({walletaddress: {$in: whitelist.map(addr => new RegExp(`^${addr}$`, 'i'))}})
                .then((result) => {
                    whales = result
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

        const updateLoans = function(){
            return new Promise(async function(resolve, reject) {          
                let loans = []
                let totall = 0
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

                for (const e of whales) {               
                    let offers = await Offer.find({member_id: e._id, status: 0}).populate("member_id").populate("borrower_id")        
                    totall += offers.length                
                    loans.push(...offers)
                }

                
                let ctr = 0
                async.eachSeries(loans, function (e, next) {                     
                    ctr += 1                            
                    guaranteeLoan(e, pmlprice, pfiprice, pfbprice, pfsprice, pfgprice, function(retType){                    
                        if (retType.collateraltype == 1) {
                            // console.log(retType)
                            countpml += 1
                            totalpml += Number(retType.amount)                         
                            // console.log(totalpml)
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
                    console.log("Total open loans for guarantee: " + ctr)
                    console.log("Total PML collateral needed: " + countpml + " (" + roundToTwo(totalpml) + " PML)")
                    console.log("Total PFI collateral needed: " + countpfi + " (" + roundToTwo(totalpfi) + " PFI)")
                    console.log("Total PFB collateral needed: " + countpfb + " (" + roundToTwo(totalpfb) + " PFB)")
                    console.log("Total PFS collateral needed: " + countpfs + " (" + roundToTwo(totalpfs) + " PFS)")
                    console.log("Total PFG collateral needed: " + countpfg + " (" + roundToTwo(totalpfg) + " PFG)")
                    console.log("Total open loans for whales: " + totall)
                    resolve()
                })                                
            })
        }

        getWhales()
        .then(getPMLPrice)
        .then(getPFIPrice)
        .then(getPFBPrice)
        .then(getPFSPrice)
        .then(getPFGPrice)
        .then(updateLoans)
        .then(function () {
            console.log("Done updating guarantees")
        })
        .catch(function(err){
            console.log(err)            
        })

    }
    

    async function guaranteeLoan(data, pmlprice, pfiprice, pfbprice, pfsprice, pfgprice, cb) {
        
        let retType = {
            collateraltype: 0,
            cointtype: 0,
            amount: 0
        }
           
        try{

            if (data.member_id.collateralpayment==1){
                // console.log("Loan Ref#: " + data.refno + " Lender: " + data.member_id.fullname + "(" + data.member_id.walletaddress + ")")                       
                // console.log("pml -> " + retType.amount)          
                sendPMLTokens(data, pmlprice,  function(txhash){                             
                    let params = {
                        status: 4,
                        ispaid: true,
                        pay_pml_txhash: txhash,                          
                        paid_at: moment().toDate()       
                    }
                    Offer.findByIdAndUpdate(data._id, params)
                    .then(()=>{
                        retType.collateraltype = 1
                        retType.amount =  100 / pmlprice
                        cb(retType)
                    })
                    .catch((err)=>{ 
                        console.log(err)    
                        cb(retType)
                    })
                })                        
            }else if (data.member_id.collateralpayment==0){
                
                if (data.collateral_token_type==3) {                               
                    // console.log("pfg -> " + retType.amount)                              
                    sendPFGTokens(data, pfgprice,  function(txhash){               
                        let params = {
                            status: 4,
                            ispaid: true,
                             pay_pml_txhash: txhash,               
                            paid_at: moment().toDate()       
                        }
                        Offer.findByIdAndUpdate(data._id, params)
                        .then(()=>{
                            retType.collateraltype = 0
                            retType.cointtype = 3
                            retType.amount =  100 / pfgprice      
                            cb(retType)
                        })
                        .catch((err)=>{ 
                            console.log(err)    
                            cb(retType)
                        })
                    })                   
                }else if (data.collateral_token_type==2) {
                    // PFS                                                
                    sendPFSTokens(data, pfsprice,  function(txhash){               
                        let params = {
                            status: 4,
                            ispaid: true,
                             pay_pml_txhash: txhash,               
                            paid_at: moment().toDate()       
                        }
                        Offer.findByIdAndUpdate(data._id, params)
                        .then(()=>{
                            retType.collateraltype = 0
                            retType.cointtype = 2
                            retType.amount =  100 / pfsprice      
                            cb(retType)
                        })
                        .catch((err)=>{ 
                            console.log(err)    
                            cb(retType)
                        })               
                    })       
                }else if (data.collateral_token_type==1) {
                    // console.log("PFB")                   
                    sendPFBTokens(data, pfbprice,  function(txhash){               
                        let params = {
                            status: 4,
                            ispaid: true,
                            pay_pml_txhash: txhash,               
                            paid_at: moment().toDate()       
                        }
                        Offer.findByIdAndUpdate(data._id, params)
                        .then(()=>{
                            retType.collateraltype = 0
                            retType.cointtype = 1
                            retType.amount =  100 / pfbprice     
                            cb(retType)
                        })
                        .catch((err)=>{ 
                            console.log(err)    
                            cb(retType)
                        })               
                    })     
                
                }else if (data.collateral_token_type==0) {
                    // PFI                                                     
                    sendPFITokens(data, pfiprice,  function(txhash){   
                        // cb()            
                        let params = {
                            status: 4,
                            ispaid: true,
                            pay_pml_txhash: txhash,                            
                            paid_at: moment().toDate()       
                        }
                        Offer.findByIdAndUpdate(data._id, params)
                        .then(()=>{
                            retType.collateraltype = 0
                            retType.cointtype = 0
                            retType.amount =  100 / pfiprice      
                            cb(retType)
                        })
                        .catch((err)=>{ 
                            console.log(err)    
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

        }catch(err){
            console.log(err)
            cb(retType)
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
                            // console.log(url)
                            let res = await axios.get(url)
                            if (res.data && res.data.status == 1) {                              
                                if (res.data.data && res.data.data.isSuspended) {
                                    console.log("Suspended in PF: " + e.borrower_id.walletaddress)                                         
                                }else if (res.data.data && !res.data.data.isVerified) {
                                    console.log("Not verified in PF: " + e.borrower_id.walletaddress)                                         
                                }else if (res.data.data && !res.data.data.isTusted) {
                                    console.log("Not isTrusted in PF: " + e.borrower_id.walletaddress)                                         
                                }else{                                    
                                    console.log("Loan Ref#: " + e.refno + " Borrower: " + e.borrower_id.fullname + " address: " + e.borrower_id.walletaddress + " Date Loaned: " + moment(e.borrowed_at).format("YYYY-MM-DD"))            
                                    loanoffers.push(e)
                                }                                    
                            }else{
                                console.log("Not found in PF: " + e.borrower_id.walletaddress)                                  
                            }   
                            // await new Promise(resolve => setTimeout(resolve, 1000))                                             
                        } catch (error) {
                            console.error("Error occurred while waiting:", error)
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
                           console.log("Loan Ref#: " + e.refno + " Borrower: " + e.member_id.fullname + " Days: " + days + " Date Loaned: " + moment(e.borrowed_at).format("YYYY-MM-DD") )
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
        // cb()
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

}



module.exports = new Job()


