
const mongoose = require("mongoose")
const Schema = mongoose.Schema;

const holdingTransSchema = new Schema({
    holding_id: { type: Schema.Types.ObjectId, ref: "holding", default: null },      
    transdate: { type: Date, default: null },          
    transtype: { type: Number, default: 0 },         
    amount: { type: Number, default: 0 },
    offer_id: { type: Schema.Types.ObjectId, ref: "offer", default: null },         
})

module.exports = mongoose.model('holdingTrans', holdingTransSchema);


