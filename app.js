import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import  bodyParser  from 'body-parser';
import stripe from 'stripe'
const str = stripe(process.env.SECRET_KEY)
const app=express();
config({
    path:'./config/config.env'
})
app.use(cors({
    origin:'*',
    method:['GET',"POST"],
}))
app.use(express.json())

app.post('/checkout-session',async(req,res)=>{
  const {products}=req.body
  const lineItems=products.map((product)=>(
    {
      price_data:{
        currency:"usd",
        product_data:{
          name:product.name,
          images:[product.image]
        },
      unit_amount:Math.round(product.price*100)
      },
      quantity:product.quantity
    }))

    const session=await str.checkout.sessions.create({
      payment_method_types:["card"],
      line_items:lineItems,
      mode:"payment",
      success_url:"http://localhost:3000/success",
      cancel_url:"http://localhost:3000/cancel"
    })
  res.json({id:session.id})
})

export default app;