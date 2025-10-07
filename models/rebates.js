
const mongoose = require("mongoose")
const Schema = mongoose.Schema;

const rebatesSchema = new Schema({
    member_id: { type: Schema.Types.ObjectId, ref: "member", default: null },      
    transdate: { type: Date, default: null },            
    txhash: { type: "String", default: "" },            
    usdamount: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    loan_id: { type: Schema.Types.ObjectId, ref: "offer", default: null },        
})

module.exports = mongoose.model('rebates', rebatesSchema);
