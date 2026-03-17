import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp")
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)  // Use the original file name as the name of the file in the temp folder but you should modify it as per your requirement as many files can have the same name and it will cause issues. You can use uuid or timestamp to make the file name unique.
  }
})

const upload = multer({ 
    storage, 
})