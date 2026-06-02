import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiErrors.js';
import {User} from '../models/User.models.js';
import uploadOnCloudinary  from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { error } from 'console';
import jwt from "jsonwebtoken"
import { subscribe } from 'diagnostics_channel';

const generateAccessAndRefreshToken = async(userId) => {
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({validateBeforeSave: false})

    return { refreshToken, accessToken}
}

const registerUser = asyncHandler( async (req , res ) => {
    
    const {fullname, email , username, password} = req.body;
    // console.log(req.body);

    if( [fullname, email, username, password].some((field) => field.trim() === "") ){
        throw new ApiError(400, "All fields are required");
    }
    const userExists = await User.findOne( {
        $or: [{email}, {username}] } );
    if( userExists ){
        throw new ApiError  (400, "User with this email or username already exists");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImg[0]?.path;
    
    // Is throwing error if cover image is not provided, stating it is undefined, so added a condition to check if cover image path exists before uploading to cloudinary

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImg) && req.files.coverImg.length > 0){
        coverImageLocalPath = req.files.coverImg[0].path;
    }

    // console.log(req.files);
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar image is required");
    }
    
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImg = await uploadOnCloudinary(coverImageLocalPath); 

    if(!avatar){
        throw new ApiError(400, "Avatar image is required");
    }
    
    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImg: coverImg?.url || "",
        email,
        username: username.toLowerCase(),
        password
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if(!createdUser){
        throw new ApiError(500, "User creation failed");
    }

    return res.status(201).json( new ApiResponse(201, createdUser, "User registered successfully") );
});

const loginUser = asyncHandler( async(req, res) => {
    /* Steps for login 
    Get req body -> data
    username or email
    check in db if exists then
    match password 
    generate access and refresh token
    send them through cookie 
    */

    const {username, email, password} = req.body;

    if(!(username || email)){
        throw new ApiError(400, "Username is blank ")
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
})
    if(!user){
        throw new ApiError(400, "User doesn't exist")
    }

    const isPassValid = await user.isPasswordCorrect(password)

    if(!isPassValid){
        throw new ApiError(400, "Password is incorrect")
    }

    const {refreshToken , accessToken} = await generateAccessAndRefreshToken(user._id)
    // We are making the call to database to get the user again without the refreshToken and Password 
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // creating cookie 
    const options = { 
        httpOnly: true, //This allows only the server to define the cookie no alteration from the client
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken" , accessToken, options) //Sending cookie with the help of cookie-parser -> syntax Name , value and options
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken 
        },
        "User LoggedIn Successful"
    )
)
} )


const logOut = asyncHandler( async(req, res) => {
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken : undefined,
            }
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse
    (200, {}, "User loggedOut Successfully")
    )
})

const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorised Request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(401,"invalid refresh token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "refresh token expired or invalid")
        }
        const options ={
            http: true,
            secure: true
        }
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(new ApiResponse(200, {accessToken, newRefreshToken}, "Access token refreshed successfully"))
    } catch (error) {
        throw new ApiError(401, "Invalid refresh token")
    }
})

const changePassword = asyncHandler( async(req, res) => {
    const {oldPassword , newPassword} = req.body;

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect){
        throw new ApiError(400, "Incorrect Password")
    }
    user.password = newPassword;
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password Changed Successfully"))
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req, res) =>{
    const {fullname, email} = req.body;

    if(!fullname || !email){
        throw new ApiError(400, "enter The fullName or email to update");
    }
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: { 
                fullname,
                email: email, //Both are the same thing just that we can use both 
            }
        },
        {
            new: true, //This returns the updated user from the db
        }
    ).select("=password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Updated"))
})

const updateUserAvatar = asyncHandler(async(req , res) => {
    const avatarLocalPath = req.file?.path

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while changing avatar")
    }
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                avatar: avatar.url,
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar Updated Successfully"))
})
const updateUserCoverImg = asyncHandler(async(req , res) => {
    const coverImgLocalPath = req.file?.path

    const coverImg = await uploadOnCloudinary(coverImgLocalPath)

    if(!coverImg.url){
        throw new ApiError(400, "Error while changing coverImg")
    }
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                coverImg: coverImg.url,
            }
        },
        {new: true}
    ).select("-password")

    
    return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Img Updated Successfully"))
})

const getUserChannelProfile = asyncHandler( async(req, res) => {
    const {username} = req.params;

    if(!username?.trim()){
        throw new ApiError(400, "Username is required")
    }

    // We are using aggregation here to get - learn about it in detail for mongoose and mongodb
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        // Getting our subscribers 
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        // Getting the channels we r subscribed to
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers"
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false,
                    }
                }
            }
        },
        {
            // Only required value will be shared by keeping 1
            $project: {
                fullname: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImg: 1,
                username: 1,
                subscriberCount: 1,
                channelSubscribedToCount: 1,
                email: 1,
            }
        }
    ])
    if(!channel?.length){
        throw new ApiError(404, "Channel not found")
    }
    // TO know which data type aggregrate return 
    console.log(channel)

    return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "Channel profile fetched successfully"))
})

const getWatchHistory = asyncHandler( async(req, res) => {
    // When we do req.user._id we get it in string because of mongoose but in db it is stored as objectId so we need to convert it to ObjectId to match it with the data in db
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id) // Ensure type matches MongoDB's ObjectId when querying by _id
            }
        },
        {
        $lookup: {
            from: "videos",
            localField: "watchHistory",
            foreignField: "_id",
            as: "watchHistory",
            pipeline: [
                {
                    $lookup: {
                        from: "users",
                        localField: "owner",
                        foreignField: "_id",
                        as: "owner",
                        pipeline: [
                            {
                                $project: {
                                    username: 1,
                                    avatar: 1
                                }
                            }
                        ]
                    }
                },
                {
                    //This is used to seend the array in a good way - sending the first field either by using Array[0]
                    $addFields: {
                        owner: {
                            $first: "$owner"
                        }
                    }
                }
            ]
        }
                
        }
    ]);
    return res
    .status(200)
    .json(new ApiResponse(200, user[0]?.watchHistory , "Watch history fetched successfully"))
}
);

export { registerUser, loginUser, logOut,refreshAccessToken, changePassword, updateAccountDetails, updateUserAvatar, updateUserCoverImg, getWatchHistory, getCurrentUser, getUserChannelProfile }