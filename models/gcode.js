
const mongoose = require("mongoose")
const Schema = mongoose.Schema;

const gcodechema = new Schema({  
    id: { type: "String", default: "" },
    code: { type: "String", default: "" },
    used : { type: Boolean, default: false },
    member_id: { type: Schema.Types.ObjectId, ref: "member", default: null },   
    transdate: { type: Date, default: null },  
})

module.exports = mongoose.model('gcode', gcodechema);
