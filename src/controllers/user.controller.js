import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiErrors.js';
import {User} from '../models/User.models.js';
import uploadOnCloudinary  from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { error } from 'console';
import jwt from "jsonwebtoken"

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



export { registerUser, loginUser, logOut,refreshAccessToken, changePassword, updateAccountDetails, updateUserAvatar, updateUserCoverImg}