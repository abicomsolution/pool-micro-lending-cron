
const mongoose = require("mongoose")
const Schema = mongoose.Schema;

const offerSchema = new Schema({
   member_id: { type: Schema.Types.ObjectId, ref: "member", default: null },
    refno: { type: "String", default: "" },        
    transdate: { type: Date, default: null },            
    amount: { type: Number, default: 0 },    
    days: { type: Number, default: 0 },    
    status: { type: Number, default: 0 },    
    txhash: { type: "String", default: "" },
    collateral_token_type: { type: Number, default: 0 },       
    collateral_token: { type: Number, default: 0 },       
    collateral_txhash: { type: "String", default: "" },
    pml_txhash: { type: "String", default: "" },
    borrowed_at: { type: Date, default: Date.now },
    ispaid: { type: Boolean, default: false },
    paid_at: { type: Date, default: null },
    borrower_id: { type: Schema.Types.ObjectId, ref: "member", default: null },
    received_pml_tokens: { type: Number, default: 0 },       
    pay_pml_txhash: { type: "String", default: "" },
    pay_collateral_txhash: { type: "String", default: "" },
    hasRebate: { type: Boolean, default: false },
    lender_photo: { type: "String", default: "" },
    borrower_photo: { type: "String", default: "" },
    payer_photo: { type: "String", default: "" }
})

module.exports = mongoose.model('offer', offerSchema);

//status
// 0 - Open
// 1 - Active
// 2 - Default
// 3 - Paid
// 4 - Guarantee Paid


