const Member = require("./models/member")
const _ = require("lodash")
const async = require("async")
const { S3Client, PutObjectCommand, GetObjectCommand } =require("@aws-sdk/client-s3");
// const tf = require("@tensorflow/tfjs-node");
const tf = require("@tensorflow/tfjs");
const blazeface = require("@tensorflow-models/blazeface");
const sharp = require("sharp");
const { uuid } = require('uuidv4');
const Offer = require("./models/offer")

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
});

// Padding around the face crop
const PADDING_RATIO = 0.15; // 25% padding

// Minimum face size filter (skip tiny detections)
const MIN_FACE_PX = 25;


function Job1() {

    this.runFaceRecognition = async function () {

        


        async function downloadS3Image(bucket, key) {
           
            const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
            const buf = await streamToBuffer(res.Body);
            return buf;
        }

        async function streamToBuffer(body) {
            // body is a Readable stream
            const chunks = [];
            for await (const chunk of body) chunks.push(chunk);
            return Buffer.concat(chunks);
        }

        // ---------- FACE DETECTION + CROP ----------
        async function detectFaces(model, imageBuffer) {
            // Decode into Tensor
            const imgTensor = tf.node.decodeImage(imageBuffer, 3); // [h,w,3]
            try {
                const preds = await model.estimateFaces(imgTensor, false); // returns topLeft/bottomRight
                return { preds, imgTensor };
            } catch (e) {
                imgTensor.dispose();
                throw e;
            }
        }

        function clamp(v, min, max) {
          return Math.max(min, Math.min(max, v));
        }


       async function uploadToS3(bucket, key, buffer, contentType = "image/jpeg") {
            await s3.send(new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: buffer,
                ContentType: contentType,
            }));
        }


        async function cropFacesFromBuffer(originalBuf, faces, outFormat = "jpeg") {
           const meta = await sharp(originalBuf).metadata();
            const imgW = meta.width || 0;
            const imgH = meta.height || 0;

            const crops = [];

            for (let i = 0; i < faces.length; i++) {
                const f = faces[i];

                const [x1, y1] = f.topLeft;
                const [x2, y2] = f.bottomRight;

                const bw = x2 - x1;
                const bh = y2 - y1;

                if (bw < MIN_FACE_PX || bh < MIN_FACE_PX) continue;

                // ---- Base padding (asymmetric) ----
                const padL = bw * 0.20;
                const padR = bw * 0.20;
                const padT = bh * 0.30;
                const padB = bh * 0.70; // heavy bottom padding (chin safety)

                let left = x1 - padL;
                let top = y1 - padT;
                let right = x2 + padR;
                let bottom = y2 + padB;

                // ---- Landmark-driven safety: ensure mouth is included + add chin margin ----
                // BlazeFace landmarks: 6 points; mouth is usually index 3
                // (If your version differs, we also fallback to "lowest landmark" heuristic.)
                let mouthY = null;

                if (Array.isArray(f.landmarks) && f.landmarks.length) {
                // Try index 3 first (common)
                const lm3 = f.landmarks[3];
                if (lm3 && typeof lm3[1] === "number") {
                    mouthY = lm3[1];
                } else {
                    // fallback: take lowest landmark y as "mouth-ish"
                    mouthY = Math.max(...f.landmarks.map((p) => p?.[1]).filter((v) => typeof v === "number"));
                }
                }

                if (typeof mouthY === "number") {
                const chinMargin = Math.max(20, bh * 0.35); // add extra below mouth
                bottom = Math.max(bottom, mouthY + chinMargin);
                } else {
                // no landmarks available -> add even more conservative bottom padding
                bottom = Math.max(bottom, y2 + Math.max(30, bh * 0.90));
                }

                // ---- Make it square around center (optional but helps downstream) ----
                const cx = (left + right) / 2;
                const cy = (top + bottom) / 2;
                const w = right - left;
                const h = bottom - top;
                const side = Math.max(w, h);

                left = cx - side / 2;
                right = cx + side / 2;
                top = cy - side / 2;
                bottom = cy + side / 2;

                // clamp + ints
                left = clamp(Math.floor(left), 0, imgW - 1);
                top = clamp(Math.floor(top), 0, imgH - 1);
                right = clamp(Math.ceil(right), 0, imgW);
                bottom = clamp(Math.ceil(bottom), 0, imgH);

                const cropW = Math.max(1, right - left);
                const cropH = Math.max(1, bottom - top);

                const cropBuf = await sharp(originalBuf)
                .extract({ left, top, width: cropW, height: cropH })
                [outFormat]({ quality: 90 })
                .toBuffer();

                crops.push({ index: i, buffer: cropBuf, box: { left, top, cropW, cropH } });
            }

            return crops;
        }


        await tf.ready();
        const model = await blazeface.load();
      
        let verified = await  Member.find({status: 1}).exec();

        console.log("Total verified members with photos:", verified.length)

        let bucket = process.env.AWS_BUCKET;
        let processed = 0;
        let totalFaces = 0;
        let OUT_PREFIX = "faces/"

        await Promise.all(            
            verified.map(async(member)=>{
                try {
                    let photo = member.photo;
                    let tpe = 0
                    if (!member.photo || member.photo.trim() === "") {
                        let off =  await Offer.findOne({ member_id: member._id, lender_photo: { $ne: "" }}).sort({transdate: -1})
                        if (off){
                            tpe = 1                          
                            photo = off.lender_photo;
                        }else{
                            off =  await Offer.findOne({ borrower_id: member._id, borrower_photo: { $ne: "" }}).sort({transdate: -1})
                            if (off) {
                                tpe = 2
                                photo = off.borrower_photo;
                            }
                        }
                    }
                    if (photo.trim() === "") {                     
                        // console.log(`[no photo] Member ${member._id}`); 
                        return                       
                    }else{
                        console.log(`Processing member ${member.fullname} -> ${tpe} with photo: ${photo}`);
                        const u = new URL(photo);
                        let key = decodeURIComponent(u.pathname.replace(/^\/+/, ""));                    
    
                        const imgBuf = await downloadS3Image(bucket, key);
                        const { data, info } = await sharp(imgBuf)
                        .removeAlpha()
                        .raw()
                        .toBuffer({ resolveWithObject: true });

                        const imgTensor  = tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels], "int32");
                        
                        const preds = await model.estimateFaces(imgTensor, false);

                        imgTensor.dispose();

                        console.log(`Member ${member._id} - detected faces:`, preds.length);
                    
                        if (!preds || preds.length === 0) {
                            processed++;
                            console.log(`[0 face] ${key}`);
                            return;
                        }

                        const crops = await cropFacesFromBuffer(imgBuf, preds, "jpeg");
                        console.log(`Member ${member._id} - cropped faces:`, crops.length);
                        if (crops.length === 0) {
                            processed++;
                            console.log(`[faces too small/filtered] ${photo}`);
                            return;
                        }
                        console.log(key)                    
                        processed++;
                        totalFaces++;
                        await Promise.all(crops.map(async (c) => {
                            let newkey = uuid();
                            const outKey = `${OUT_PREFIX}${newkey.replace(/\//g, "_")}_face_${c.index}.jpg`;                          
                            await uploadToS3(bucket, outKey, c.buffer, "image/jpeg");                        
                            // await s3.send(new PutObjectCommand({Bucket: bucket, Key: outKey, Body: c.buffer}))  
                            let faceUrl = `${process.env.AWS_BUCKET_URL}${outKey}`;
                            await Member.updateOne({ _id: member._id }, { facephoto: faceUrl });
                            processed++;
                            totalFaces++;
                            console.log("Face URL:",  member._id, member.fullname, faceUrl, photo);
                        }));
                    }
                   
                }catch (e) {
                    console.log("Error processing member:", member._id, member.fullname + ", " + member.walletaddress, e)
                }
            })
        )         

      
   
        console.log("Done total verified members:", verified.length)
    }

}

module.exports = new Job1()