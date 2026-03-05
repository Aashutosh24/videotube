import mongoose, {Schema} from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new Schema(
    {
        username:{
            type:String,
            required:true,
            unique:true,
            trim: true,
            lowercase: true,
            index: true // Can improve query performance(Searching by username) by downfalls the performance of write operations (inserts, updates, deletes)
        },
        email:{
            type:String,
            required:true,
            unique:true,
            trim: true,
            lowercase: true
        },
        fullname:{
            type:String,
            required:true,
            trim: true,
            index: true
        },
        avatar:{
            type:  String, //Cloudinary URL for the user's avatar image
            required: true
        },
        coverImg:{
            type: String, //Cloudinary URL for the user's cover image
        },
        watchList:[ 
            {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Video"
        }
    ],
        password:{
            type:String,
            required:[true, "Password is required"]
        },
        refreshToken:{
            type:String
        }

    },{
        timestamps:true
    }
)

userSchema.pre("save", async function (next) {
    if(!this.isModified("password")) return next() // If the password field is not modified, skip hashing and proceed to the next middleware or save operation.

    this.password = bcrypt.hash(this.password, 10)
    next()
})

userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = function () {
    return jwt.sign({
        _id: this._id,
        username: this.username,
        email: this.email,
        fullname: this.fullname
    },
    process.env.ACCESS_TOKEN_SECRET,{
        expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN
    })
}
userSchema.methods.generateRefreshToken = function () {
    return jwt.sign({
        _id: this._id
    },
    process.env.REFRESH_TOKEN_SECRET,{
        expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN
    })
}


export const User =  mongoose.model("User", userSchema)