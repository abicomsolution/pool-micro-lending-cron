
const mongoose = require("mongoose")
const Schema = mongoose.Schema;

const memberSchema = new Schema({
    sponsor_id: { type: Schema.Types.ObjectId, ref: "member", default: null },    
    walletaddress: { type: "String", default: "" },
    account_type: { type: Number, default: 0 },    
    date_joined: { type: Date, default: null },            
    photo: { type: "String", default: "" },        
    email: { type: "String", default: "" },    
    mobile: { type: "String", default: "" },       
    fullname: { type: "String", default: "" },        
    country: { type: "String", default: "" },    
    hasaaccessfee : { type: Boolean, default: false },
    status: { type: Number, default: 0 },
    collateralpayment : { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    photo: { type: "String", default: "" },
    telegram: { type: "String", default: "" }
}, { toJSON: { virtuals: true } });


module.exports = mongoose.model("member", memberSchema);
