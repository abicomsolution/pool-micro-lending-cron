
const mongoose = require("mongoose")
const Schema = mongoose.Schema;

const whitelistSchema = new Schema({   
    member_id: { type: Schema.Types.ObjectId, ref: "member", default: null },
    walletaddress: { type: "String", default: "" },         
    status: { type: Number, default: 0 }    
})

module.exports = mongoose.model('whitelist', whitelistSchema);
