import mongoose from "mongoose";
import { DB_NAME } from "./constants.js";
import express from "express";
import connectDB from "./db/index.js";


connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running on port ${process.env.PORT}`);
    })
} )
.catch( (err) => {
    console.log("MongoDB connection failed!!", err);
})



// Method 1 - where we directly connect to MongoDB and start the server index directly
/*
const app = express();
// iife - immediately invoked function expression - function that runs as soon as it is defined
( async() => {
    try{
    await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`);
    app.on("error", (error) => {
        console.log(`Error: `, error);
        throw error;
    })
    app.listen(process.env.PORT, () => {
        console.log(`Server is running on port ${process.env.PORT}`);
    }  );
    
}
    catch(err){
        console.log("Error connecting to MongoDB", err);
        throw err;
    }
})()
    */