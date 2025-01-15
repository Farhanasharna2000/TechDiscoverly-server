require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId} = require('mongodb')
const jwt = require('jsonwebtoken')
const morgan = require('morgan')
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 2000
const app = express()
// middleware

app.use(cors())
app.use(express.json())
app.use(morgan('dev'))



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zlou2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})
async function run() {
  try {
    const usersCollection = client.db('TechDiscoverly').collection('users')
    const productsCollection = client.db('TechDiscoverly').collection('products')

  


 //jwt related apis
 app.post('/jwt', async (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.SECRET_KEY, { expiresIn: '365d' })
  res.send({ token })
})
  //middlewares:
    //verifyToken
    const verifyToken = (req, res, next) => {
      // console.log('inside token',req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' })
      }
      const token = req.headers.authorization.split(' ')[1];

      jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })

        }
        req.decoded = decoded;
        next()
      })
    }
     //use verify Admin after verifytoken
     const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin'
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()
    }
  //get users data based on email from db

  app.get('/users/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    if (email !== req.decoded.email) {
      return res.status(403).send({ message: 'forbidden access' });
    }
    const query = { email };
    const user = await usersCollection.findOne(query);
    res.send(user);
  });
    // get user role
    app.get('/users/role/:email', async (req, res) => {
      const email = req.params.email
      const result = await usersCollection.findOne({ email })

      res.send({ role: result?.role })
    })
      // get all user data
      app.get('/all-users/:email', verifyToken,  async (req, res) => {
        const email = req.params.email
        const query = { email: { $ne: email } } //admin email bade
        const result = await usersCollection.find(query).toArray()
        res.send(result)
      })
       // update a user role & status
    app.patch(
      '/user/role/:email',
      verifyToken,

      async (req, res) => {
        const email = req.params.email
        const { role } = req.body
        const filter = { email }
        const updateDoc = {
          $set: { role },
        }
        const result = await usersCollection.updateOne(filter, updateDoc)
        res.send(result)
      }
    )
    //post users collection in db

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'user already exist', insertedId: null })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
 //post product data in db

 app.post('/product', verifyToken,  async (req, res) => {
  const product = req.body;
  const result = await productsCollection.insertOne({...product, timestamp: Date.now()} );
  res.send(result);
});
// get all products for a specific user
app.get('/products/:email', verifyToken, async (req, res) => {
  const email = req.params.email
  const query = { 'ownerEmail': email }
  const result = await productsCollection.find(query).toArray()

  res.send(result)
})
//update product data from db
app.get('/product/:id', async (req, res) => {
  const id = req.params.id;

  const query = { _id: new ObjectId(id) }
  const result = await productsCollection.findOne(query);


  res.send(result);
})
app.patch('/product/:id', async (req, res) => {
  const product = req.body;
  const id = req.params.id;

  const filter = { _id: new ObjectId(id) }
  const updatedDoc = {
    $set: {
      productName: product.productName,
      description: product.description,
      link: product.link,
      tags: product.tags,


    }
  }
  const result = await productsCollection.updateOne(filter, updatedDoc);

  res.send(result);
})
 // delete a product
 app.delete('/products/:id', verifyToken, async (req, res) => {
  const id = req.params.id
  const query = { _id: new ObjectId(id) }

  const result = await productsCollection.deleteOne(query)
  res.send(result)
})
//payment
app.post("/create-payment-intent", async (req, res) => {
  try {
    const { amount,email } = req.body;


    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: "usd",
      
      "payment_method_types": [
        "card"
      ],
    });

    res.send({ clientSecret: paymentIntent.client_secret });

  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});
// Update Subscription After Payment Success
app.post("/update-subscription", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).send({ error: "Email is required" });
    }

    // Update user's subscription status in the database
    const result = await usersCollection.updateOne(
      { email: email },
      { $set: { isSubscribed: true } }
    );

    if (result.modifiedCount > 0) {
      res.send({ success: true, message: "Subscription updated successfully" });
    } else {
      res.status(404).send({ error: "User not found" });
    }
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('TechDiscoverly Server...')
})

app.listen(port, () => {
  console.log(`TechDiscoverly is running on port ${port}`)
})
