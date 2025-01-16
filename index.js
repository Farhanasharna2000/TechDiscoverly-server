require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
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
      const isAdmin = user?.role === 'Admin'
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()
    }
    //use verify Moderator after verifytoken
    const verifyModerator = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const isModerator = user?.role === 'Moderator'
      if (!isModerator) {
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
    app.get('/all-users/:email', verifyToken,verifyAdmin, async (req, res) => {
      const email = req.params.email
      const query = { email: { $ne: email } } 
      const result = await usersCollection.find(query).toArray()
      res.send(result)
    })
    // update a user role & status
    app.patch(
      '/user/role/:email',
      verifyToken,
      verifyAdmin,
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

    app.post('/product', verifyToken, async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne({ ...product, timestamp: Date.now() });
      res.send(result);
    });
    // get all products for a specific user
    app.get('/products/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const query = { 'ownerEmail': email }
      const result = await productsCollection.find(query).toArray()

      res.send(result)
    })
    // get all products 
    app.get('/products', verifyToken,verifyModerator, async (req, res) => {
      const result = await productsCollection.aggregate([
          {
              $addFields: {
                  statusOrder: {
                      $switch: {
                          branches: [
                              { case: { $eq: ["$status", "pending"] }, then: 1 },
                              { case: { $eq: ["$status", "accepted"] }, then: 2 },
                              { case: { $eq: ["$status", "rejected"] }, then: 3 }
                          ],
                          default: 4
                      }
                  }
              }
          },
          {
              $sort: {
                  statusOrder: 1,
                  timestamp: -1  
              }
          },
          { $project: { statusOrder: 0 } }
      ]).toArray();
      
      res.send(result);
  });
    // Update product status
    app.post('/updateProductStatus',verifyToken,verifyModerator, async (req, res) => {
      const { id, isRejected, isAccepted, isFeatured, status } = req.body;
  
      try {
          const filter = { _id: new ObjectId(id) };
          const update = {};
  
          if (typeof isRejected !== 'undefined') update.isRejected = isRejected;
          if (typeof isAccepted !== 'undefined') update.isAccepted = isAccepted;
  
          if (typeof isFeatured !== 'undefined') update.isFeatured = isFeatured;
  
          if (status) update.status = status;
  
        
          const result = await productsCollection.updateOne(filter, { $set: update });
  
          if (result.modifiedCount > 0) {
              res.status(200).send({ message: 'Status updated successfully' });
          } else {
              res.status(400).send({ message: 'Failed to update status' });
          }
      } catch (error) {
          console.error('Error updating status:', error);
          res.status(500).send({ message: 'Internal server error' });
      }
  });
  
  
  
    //update product data from db
    app.get('/product/:id',verifyToken, async (req, res) => {
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
    app.post("/create-payment-intent",verifyToken, async (req, res) => {
      try {
        const { amount, email } = req.body;


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
    app.post("/update-subscription",verifyToken, async (req, res) => {
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
//get featured data from db
app.get('/featurdProducts', async (req, res) => {
  const result = await productsCollection.find({ isFeatured: true }&&{ isAccepted: true }).sort({ timestamp: -1 }).limit(4).toArray();
  res.send(result);
})
//get trendingProducts data from db
app.get('/trendingProducts', async (req, res) => {
  const result = await productsCollection.find({ isAccepted: true }) .sort({ upvoteCount: -1 }).limit(6).toArray();
  res.send(result);
})
//get all accepted products data from db
app.get('/acceptedProducts', async (req, res) => {
  const { tag, page = 1, limit = 6 } = req.query;
  const filter = { isAccepted: true };
  
  if (tag) {
    filter.tags = tag;
  }

  try {
    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count for pagination
    const totalCount = await productsCollection.countDocuments(filter);
    
    // Get paginated results
    const result = await productsCollection
      .find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
      
    res.send({
      products: result,
      totalProducts: totalCount,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit))
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

    // Send a ping to confirm a successful connection
    // await client.db('admin').command({ ping: 1 })
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
