import mongoose from "mongoose";
import MongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";
const videoSchema = new mongoose.Schema(
    {
        videoFile:{
            type: String, //Cloudinary URL for the video file
            required: true
        },
        thumbnail:{
            type: String, //Cloudinary URL for the video's thumbnail image
            required: true
        },
        title:{
            type: String,
            required: true,
        },description:{
            type: String,
            required: true,
        },
        duration:{
            type: Number, // Cloudinary provides the duration of the video 
            required: true
        },
        views:{
            type: Number,
            default: 0
        },
        isPublished:{
            type: Boolean,
            default: true
        },
        owner:{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }
    },{
        timestamps:true
    }
)

videoSchema.plugin(MongooseAggregatePaginate)

export const Video = mongoose.model("Video", videoSchema)