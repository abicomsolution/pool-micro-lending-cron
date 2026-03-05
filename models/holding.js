
const mongoose = require("mongoose")
const Schema = mongoose.Schema;

const holdingSchema = new Schema({
    member_id: { type: Schema.Types.ObjectId, ref: "member", default: null },          
    accumulated: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    balance: { type: Number, default: 0 }          
})

module.exports = mongoose.model('holding', holdingSchema);

