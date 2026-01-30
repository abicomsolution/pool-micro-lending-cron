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

const EMBED_MODEL_URL ="https://vladmandic.github.io/human-models/models/mobilefacenet.json"

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


      this.runFaceRecognition2 = async function () {

        let embedModel;
        let blaze

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
      
        async function detectBestFaceBox(source) {

            if (!blaze) throw new Error("Models not initialized");
            const preds = await blaze.estimateFaces(source, false);

            if (!preds.length) return null;

            // pick largest face
            preds.sort((a, b) => {
                const [ax1, ay1] = a.topLeft
                const [ax2, ay2] = a.bottomRight
                const [bx1, by1] = b.topLeft
                const [bx2, by2] = b.bottomRight 
                const aArea = (ax2 - ax1) * (ay2 - ay1);
                const bArea = (bx2 - bx1) * (by2 - by1);
                return bArea - aArea;
            });

            const f = preds[0];
            const [x1, y1] = f.topLeft
            const [x2, y2] = f.bottomRight

            return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
        }

        function cropTo112(source,box) {
            
            return tf.tidy(() => {
                const [H, W] = source.shape;
                // Expand box a bit
                const pad = 0.15;
                const x = Math.max(0, box.x - box.w * pad);
                const y = Math.max(0, box.y - box.h * pad);
                const w = Math.min(W - x, box.w * (1 + 2 * pad));
                const h = Math.min(H - y, box.h * (1 + 2 * pad));

                const y1 = y / H;
                const x1 = x / W;
                const y2 = (y + h) / H;
                const x2 = (x + w) / W;

                const crop = tf.image.cropAndResize(
                source.expandDims(0),                  // [1,H,W,3]
                tf.tensor2d([[y1, x1, y2, x2]]),     // boxes
                tf.tensor1d([0], "int32"),           // boxInd
                [112, 112]
                ); // [1,112,112,3]

                return crop.toFloat().div(255); // [0..1]
            });
        }

        function l2Normalize(vec) {
            let sum = 0;
            for (const v of vec) sum += v * v;
            const norm = Math.sqrt(sum) || 1;
            return vec.map((v) => v / norm);
        }

      

        function faceBoxToSharpBox(faceBox, imgW, imgH) {
            let left = Math.floor(faceBox.x);
            let top = Math.floor(faceBox.y);
            let width = Math.floor(faceBox.w);
            let height = Math.floor(faceBox.h);

            // Clamp to image bounds
            left = Math.max(0, Math.min(left, imgW - 1));
            top = Math.max(0, Math.min(top, imgH - 1));

            width = Math.max(1, Math.min(width, imgW - left));
            height = Math.max(1, Math.min(height, imgH - top));

            return { left, top, width, height };
        }

        await tf.ready();
        if (tf.getBackend() !== "webgl") {
            try {
                await tf.setBackend("webgl");
            } catch {
            // fallback is fine
            }
        }
    
        blaze  = await blazeface.load();
        if (!embedModel) embedModel = await tf.loadGraphModel(EMBED_MODEL_URL);

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
                        
                        const box = await detectBestFaceBox(imgTensor);
                        console.log(`Member ${member._id} - detected faces:`, box ? 1 : 0);
                        if (!box) return null;                                                    
                        
                        const face112 = cropTo112(imgTensor, box);      
                                               
                        imgTensor.dispose();

                        const out = embedModel.predict(face112)

                        const emb = (await out.squeeze().array());

                        face112.dispose();
                        out.dispose();

                        let normEmb = l2Normalize(emb);
                        let params = {
                            embedding: normEmb,
                            dims: normEmb.length
                        }
                        await Member.updateOne({ _id: member._id }, params);
                        console.log("Saved embedding for member:", member._id, member.fullname);
                                                                            
                        // const meta = await sharp(imgBuf).metadata();
                        // const sharpBox = faceBoxToSharpBox(box, meta.width || 0, meta.height || 0);            

                        // console.log(key)                    
                        // processed++;
                        // totalFaces++;
                       
                        // let newkey = uuid();
                        // const outKey = `${OUT_PREFIX}${newkey.replace(/\//g, "_")}_face.jpg`;                                                        
                        // const croppedBuffer = await sharp(imgBuf).extract(sharpBox).jpeg({ quality: 90 }).toBuffer();                              
                        // await uploadToS3(bucket, outKey, croppedBuffer, "image/jpeg");                        
                        // // await s3.send(new PutObjectCommand({Bucket: bucket, Key: outKey, Body: c.buffer}))  
                        // let faceUrl = `${process.env.AWS_BUCKET_URL}${outKey}`;
                        // await Member.updateOne({ _id: member._id }, { facephoto: faceUrl });
                        // processed++;
                        // totalFaces++;
                        // console.log("Face URL:",  member._id, member.fullname, faceUrl, photo);
                     
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