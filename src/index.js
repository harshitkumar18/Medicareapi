//  require('dotenv').config({path: './env'})
import dotenv from "dotenv"
import {app} from './app.js'
dotenv.config (
   {
       path: './.env'
   }
)

app.on("error",(error)=>{
   console.log("ERROR: ",error);
   throw error
})

app.listen(process.env.PORT || 7000, () => {
   console.log(`Server is running at port ${process.env.PORT || 7000}`);
})













/*import express from "express"
const app = express()

(async () =>{
   try {
       await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
       app.on("error",(error)=>{
           console.log("ERROR: ",error);
           throw error
       })
       app.listen(process.env.PORT,()=>{
           console.log(`App is running on ${PORT}`)
       })
   } catch (error) {
       console.log("ERROR: ", error)
       throw error

   }
})()*/

