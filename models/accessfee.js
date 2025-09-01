
const mongoose = require("mongoose")
const Schema = mongoose.Schema;

const acessFeeSchema = new Schema({
    member_id: { type: Schema.Types.ObjectId, ref: "member", default: null },      
    transdate: { type: Date, default: null },            
    txhash: { type: "String", default: "" },            
    amount: { type: Number, default: 0 }    
})

module.exports = mongoose.model('accessfee', acessFeeSchema);
