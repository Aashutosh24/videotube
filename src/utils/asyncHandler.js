// const asyncHandler = () => {}
// const asyncHandler = (func ) => () => {}
// const asyncHandler = (func) => async() => {}



const asyncHandler = (requestHandler) => {
    (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch((err) => {
            next(err)
        })
    }
}

export { asyncHandler}
    // This is through async await now lets do by promise chaining
// const asyncHandler = (func) => async(req, res,next) => {
//     try {
//         await func(req, res, next);
//     } catch (error) {
//         res.status(error.code || 500).json({
//             success: false,
//             message: error.message
//         })
//     }
// }
