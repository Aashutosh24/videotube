import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

import { v2 as cloudinary } from 'cloudinary';

(async function() {
    cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    
    const uploadOnCloudinary = async (filePath) => {
        try {
            if(!filePath) {
                return null;
            }
            // Upload the file to Cloudinary
            const response = await cloudinary.uploader.upload(filePath, { resource_type: 'auto' });

            // If file is uploaded successfully
            console.log('File uploaded successfully to Cloudinary', response.url);
            return response;

        } catch (error) {
            fs.unlinkSync(filePath); // remove the temporarily stored file from local storage as the operation failed
            return null;
        }

    }    
});

export default uploadOnCloudinary;
