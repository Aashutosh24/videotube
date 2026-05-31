import mongoose,{Schema} from 'mongoose';
import { User} from './user.models.js';
 
const subscriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId, //One who is subscribing
        ref: User,
    },
    channel: {
        type: Schema.Types.ObjectId, //One who is being subscribed to
        
    }



}, {timestamps: true})

export const Subscription = mongoose.model('Subscription',subscriptionSchema)