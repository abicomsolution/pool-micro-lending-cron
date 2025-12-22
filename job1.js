const Member = require("./models/member")
const _ = require("lodash")
const async = require("async")
const { S3Client, PutObjectCommand, GetObjectCommand } =require("@aws-sdk/client-s3");
// const tf = require("@tensorflow/tfjs-node");
const tf = require("@tensorflow/tfjs");
const blazeface = require("@tensorflow-models/blazeface");
const sharp = require("sharp");
const { uuid } = require('uuidv4');

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
            const width = meta.width || 0;
            const height = meta.height || 0;

            const crops = [];
            for (let i = 0; i < faces.length; i++) {
                const f = faces[i];
                const [x1, y1] = f.topLeft;
                const [x2, y2] = f.bottomRight;

                const bw = x2 - x1;
                const bh = y2 - y1;

                if (bw < MIN_FACE_PX || bh < MIN_FACE_PX) continue;

                const padX = bw * PADDING_RATIO;
                const padY = bh * PADDING_RATIO;

                const left = clamp(Math.floor(x1 - padX), 0, width - 1);
                const top = clamp(Math.floor(y1 - padY), 0, height - 1);
                const right = clamp(Math.ceil(x2 + padX), 0, width);
                const bottom = clamp(Math.ceil(y2 + padY), 0, height);

                const cropW = Math.max(1, right - left);
                const cropH = Math.max(1, bottom - top);

                const cropBuf = await sharp(originalBuf)
                .extract({ left, top, width: cropW, height: cropH })
                // optional: normalize size for downstream face models
                // .resize(256, 256, { fit: "cover" })
                [outFormat]({ quality: 90 })
                .toBuffer();

                crops.push({ index: i, buffer: cropBuf, box: { left, top, cropW, cropH } });
            }
            return crops;
        }


        await tf.ready();
        const model = await blazeface.load();
      
        let verified = await  Member.find({verified: true, _id: "68883042705b35e17c4be364"})

        let bucket = process.env.AWS_BUCKET;
        let processed = 0;
        let totalFaces = 0;
        let OUT_PREFIX = "faces/"

        await Promise.all(            
            verified.map(async(member)=>{
                try {
                    console.log(`Processing member ${member._id} with photo: ${member.photo}`);
                    const u = new URL(member.photo);
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
                        console.log(`[faces too small/filtered] ${member.photo}`);
                        return;
                    }
                    console.log(key)                    
                    await Promise.all(crops.map(async (c) => {
                        let newkey = uuid();
                        const outKey = `${OUT_PREFIX}${newkey.replace(/\//g, "_")}_face_${c.index}.jpg`;                          
                        await uploadToS3(bucket, outKey, c.buffer, "image/jpeg");                        
                        // await s3.send(new PutObjectCommand({Bucket: bucket, Key: outKey, Body: c.buffer}))  
                        let faceUrl = `${process.env.AWS_BUCKET_URL}${outKey}`;
                        await Member.updateOne({ _id: member._id }, { facephoto: faceUrl });
                        processed++;
                        totalFaces++;
                        console.log("Face URL:", faceUrl);
                    }));

                }catch (e) {
                    console.log("Error processing member:", member._id, e)
                }
            })
        )         

      
   
        // console.log("Done total verified members:", verified.length)
    }

}

module.exports = new Job1()