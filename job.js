const Member = require("./models/member")
const Offer = require("./models/offer")
const _ = require("lodash")
const async = require("async")
const moment = require("moment")
var ObjectId = require('mongoose').Types.ObjectId;

const { uuid } = require('uuidv4');
const fs = require('fs');
const axios = require("axios");
const { ethers, JsonRpcProvider, parseEther, formatEther  } = require('ethers')
const PMLContractConfig = require("./pmlAbi")

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

function Job() {


    this.updateLoans = async function () {        

        let defaultLoans = []

        const getDefaultLoans= function(){
            return new Promise(function(resolve, reject) {          
                Offer.find({status: 1, ispaid: false })
                .populate("member_id")               
                .then((result) => {

                    console.log("Total defaulted loans: " + result.length)            

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

        const iterateDefaultLoans = function(){
            return new Promise(function(resolve, reject){          
                    async.eachSeries(defaultLoans, function (e, next) {                     
                        
                        console.log("Loan Ref#: " + e.refno + " Borrower: " + e.member_id.fullname + " address: " + e.member_id.walletaddress)
                        next()
                        
                        // autoPayBack(e, function(){
                        //     next()
                        // })
                        
                        
                    }, function () {
                        resolve()
                    })    

            })
        }

        getDefaultLoans()    
        .then(iterateDefaultLoans)   
        .then(function () {
            console.log("Done")
        })
        .catch(function(err){
            console.log(err)            
        })

    }

    async function autoPayBack(data, cb) {

        setTimeout(() => {              
            
           
            
            // console.log(PMLContractConfig.abi)
            // console.log("Loan Ref#: " + data.refno + " Borrower: " + data.member_id.fullname + " Date Loaned: " + moment(data.borrowed_at).format("YYYY-MM-DD")  + " payme: " + data.member_id.collateralpayment)
            // cb()

            if (data.member_id.collateralpayment==1){
                sendPMLTokens(data, function(txhash){
                    let params = {
                        status: 2,
                        ispaid: true,
                        pay_pml_txhash: "",
                        pay_collateral_txhash: txhash,                
                        paid_at: moment().toDate()       
                    }
                    Offer.findByIdAndUpdate(data._id, params)
                    .then(()=>{
                        cb()
                    })                    
                })
            }


        }, 1000);


    }

     async function sendPMLTokens(data, cb) {

        console.log("sendPMLTokens.....")

        const PK = process.env.SENDER_PK
        const cwallet = new ethers.Wallet(PK, customHttpProvider)              
        const pmlContract = new ethers.Contract(PMLContractConfig.address, PMLContractConfig.abi, customHttpProvider);
        pmlContract.balanceOf(process.env.SENDER_FUND_ADDR)
        .then((pmlBalance)=>{
            let pmlB = formatEther(pmlBalance)                      
            pullPMLPrice((price)=>{                
                let pmltokens =  100 / price                
                let amtStr = stripExcessDecimals(pmltokens)                            
                if (Number(amtStr) > 0) {
                    var bgamount = parseEther(amtStr)
                    console.log(bgamount)
                    // console.log("Loan Ref#: " + data.refno + " Borrower: " + data.member_id.fullname + " Date Loaned: " + moment(data.borrowed_at).format("YYYY-MM-DD")  + " payme: " + data.member_id.collateralpayment)         
                    let receiver = data.member_id.walletaddress
                    pmlContract.connect(cwallet).transfer(receiver, bgamount)
                    .then((tx)=>{
                        tx.wait(1)
                        .then((receipt)=>{
                            console.log(receipt.hash)
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
                    cb()
                }    
            })                                  
        }).catch((err)=>{
            // console.log(err)
            console.log("e3")
            cb("")
        })


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

   

}



module.exports = new Job()


