require("dotenv").config()

const express = require('express')

const app = express();

app.listen(3001);

const aws = require('aws-sdk')
const multer = require('multer')
const multerS3 = require('multer-s3');


aws.config.update({
    secretAccessKey: process.env.ACCESS_SECRET,
    accessKeyId: process.env.ACCESS_KEY,
    region: process.env.REGION,
    endpoint: process.env.END_POINT,
    s3ForcePathStyle: true,
});

const BUCKET = process.env.BUCKET

const s3 = new aws.S3();
const maxFileSize = process.env.FILE_SIZE * 1024 * 1024; // 50 MB

const upload = multer({
    storage: multerS3({
        s3: s3,
        acl: "public-read",
        bucket: BUCKET,
        key: function (req, file, cb) {
            console.log(file);
            cb(null, file.originalname)
        }
    }),
    limits: {
        fileSize: maxFileSize
    }
}).single("file");

const imageFilter = function (req, file, cb) {
   
    // Accept images only
    if (!file.originalname.match(/\.(json|JSON|zip|jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF|ZIP|PDF)$/)) {
        const ALLOWED_FILES = 'json|JSON|zip|jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF|ZIP|PDF'
        req.fileValidationError = 'Only (' + ALLOWED_FILES + ') files are allowed!';
        return cb(new Error('Only (' + ALLOWED_FILES + ') files are allowed!'), false);
    }
    cb(null, true);
};

const storages3 = multerS3({
    s3: s3,
    acl: "public-read",
    bucket: BUCKET,
    key: function (req, file, cb) {
        console.log(file);
        cb(null, file.originalname)
    }
});


app.post('/upload-files', (req, res) => {
    // 'file' is the name of our file input field in the HTML form
    let uploadFile = multer({
        storage: storages3,
        fileFilter: imageFilter
    }).single('file');

    uploadFile(req, res, function (err) {
        // req.file contains information of uploaded file
        // req.body contains information of text fields, if there were any

        if (req.fileValidationError) {
            return res.send(req.fileValidationError);
        } else if (!req.file) {
            return res.send('Please select an valid file to upload');
        } else if (err instanceof multer.MulterError) {
            return res.send(err);
        } else if (err) {
            return res.send(err);
        }

        res.status(200).send({
            message: "Uploaded the file successfully: Filename: " + req.file.originalname + ", Location: " + req.file.location,
        });

        // Display uploaded image for user validation
        res.send(`You have uploaded this image: <hr/><img src="${req.file.path}" width="500"><hr /><a href="./">Upload another image</a>`);
    });
});

app.post('/upload', upload, async (req, res) => {

    try { //TODO: not working
        if (req.file == undefined) {
            return res.status(400).send({
                message: "Please upload a file!"
            });
        }
        if (req.file.size > maxFileSize) {
            // // File size exceeds limit, handle error accordingly
            return res.status(400).json({
                error: 'File size exceeds the allowed limit.'
            });
        }
        // upload(req, res);
        res.status(200).send({
            message: "Uploaded the file successfully: Filename: " + req.file.originalname + ", Location: " + req.file.location,
        });
    } catch (err) {
        res.status(500).send({
            message: `Could not upload the file: ${req.file.originalname}. ${err}`,
        });
    }
})

app.get("/list", async (req, res) => {

    let r = await s3.listObjectsV2({
        Bucket: BUCKET
    }).promise();
    let x = r.Contents.map(item => item.Key);
    res.send(x)
})


app.get("/download/:filename", async (req, res) => {

    const filename = req.params.filename
    let x = await s3.getObject({
        Bucket: BUCKET,
        Key: filename
    }).promise();
    res.send(x.Body)
})

app.delete("/delete/:filename", async (req, res) => {

    const filename = req.params.filename
    await s3.deleteObject({
        Bucket: BUCKET,
        Key: filename
    }).promise();
    res.send("File Deleted Successfully")
})
