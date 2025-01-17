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
    const reviewsCollection = client.db('TechDiscoverly').collection('reviews')
    const reportsCollection = client.db('TechDiscoverly').collection('reports')
    const couponsCollection = client.db('TechDiscoverly').collection('coupons')


    //jwt related apis
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_KEY, { expiresIn: '365d' })
      res.send({ token })
    })

    //middlewares:
    //verifyToken
    const verifyToken = (req, res, next) => {
      
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
    app.get('/all-users/:email', verifyToken, verifyAdmin, async (req, res) => {
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
      const { ownerEmail } = req.body;
      const user = await usersCollection.findOne({ email: ownerEmail });
      const isSubscribed = user?.isSubscribed;

      if (!isSubscribed) {
        const productCount = await productsCollection.countDocuments({ ownerEmail });
        if (productCount >= 1) {
          return res.send({
            success: false,
            message: "Non-subscribed users can only add one product.",
          });
        }
      }

      const product = req.body;
      const result = await productsCollection.insertOne({ ...product, timestamp: Date.now() });
      res.send({ success: true, result });
    });

    // get all products for a specific user
    app.get('/products/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const query = { 'ownerEmail': email }
      const result = await productsCollection.find(query).toArray()

      res.send(result)
    })

    // get all products 
    app.get('/products', verifyToken, verifyModerator, async (req, res) => {
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

    // get a product by id
    app.get('/product/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await productsCollection.findOne(query)
      res.send(result)
    })

    // Update product status
    app.post('/updateProductStatus', verifyToken, verifyModerator, async (req, res) => {
      const { id, isRejected, isAccepted, isFeatured, status } = req.body;

    
        const filter = { _id: new ObjectId(id) };
        const update = {};

        if (typeof isRejected !== 'undefined') update.isRejected = isRejected;
        if (typeof isAccepted !== 'undefined') update.isAccepted = isAccepted;

        if (typeof isFeatured !== 'undefined') update.isFeatured = isFeatured;

        if (status) update.status = status;


        const result = await productsCollection.updateOne(filter, { $set: update });

        res.send(result)
   
    });

    //update product data from db
    app.get('/product/:id', verifyToken, async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) }
      const result = await productsCollection.findOne(query);


      res.send(result);
    })
    app.patch('/product/:id', verifyToken, async (req, res) => {
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
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      
        const { amount, email } = req.body;


        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount * 100, // Convert to cents
          currency: "usd",

          "payment_method_types": [
            "card"
          ],
        });

        res.send({ clientSecret: paymentIntent.client_secret });

     
    });

    // Update Subscription After Payment Success
    app.post("/update-subscription", verifyToken, async (req, res) => {
      
        const { email } = req.body;

        const result = await usersCollection.updateOne(
          { email: email },
          { $set: { isSubscribed: true } }
        );

        res.send(result)
    });

    //get featured data from db
    app.get('/featurdProducts', async (req, res) => {
      const result = await productsCollection.find({ isFeatured: true, isAccepted: true }).sort({ timestamp: -1 }).limit(4).toArray();
      res.send(result);
    })
    //upvote functionality
    app.post('/upvote/:productId', async (req, res) => {
      const { productId } = req.params;
      const { email } = req.body;
 
        const product = await productsCollection.findOne({ _id: new ObjectId(productId) });


        if (product.voteUser && product.voteUser.includes(email)) {
          return res.status(400).json({ message: 'You have already upvoted this product' });
        }

        const result = await productsCollection.updateOne(
          { _id: new ObjectId(productId) },
          {
            $inc: { upvoteCount: 1 },
            $push: { voteUser: email }
          }
        );

        res.send(result)
    });

    //get trendingProducts data from db
    app.get('/trendingProducts', async (req, res) => {
      const result = await productsCollection.find({ isAccepted: true }).sort({ upvoteCount: -1 }).limit(6).toArray();
      res.send(result);
    })

    //get all accepted products data from db
    app.get('/acceptedProducts', async (req, res) => {
      const { tag, page = 1, limit = 6 } = req.query;
      const filter = { isAccepted: true };

      if (tag) {
        filter.tags = tag;
      }

   
        const skip = (parseInt(page) - 1) * parseInt(limit);

       
        const totalCount = await productsCollection.countDocuments(filter);
        
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
      
    });

    //post reviews collection in db

    app.post('/reviews', verifyToken, async (req, res) => {
      const reviews = req.body;

      const result = await reviewsCollection.insertOne(reviews);
      res.send(result);
    });

    //get reviews data from db
    app.get('/reviews/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { productId: id };
      const result = await reviewsCollection.find(query).toArray();

      res.send(result);
    });

    //post reports collection in db

    app.post('/reports', verifyToken, verifyModerator, async (req, res) => {

      const { productId, userEmail } = req.body;
      const existingReport = await reportsCollection.findOne({ productId, userEmail });

      if (existingReport) {
        return res.status(400).send({ message: 'You have already reported this product.' });
      }
      const result = await reportsCollection.insertOne(req.body);
      res.send(result);
    });

    //get reports data from db
    app.get('/reports', verifyToken, verifyModerator, async (req, res) => {

      const result = await reportsCollection.find().toArray();

      res.send(result);
    });

    // delete a reported product
    app.delete('/reports/:id', verifyToken, verifyModerator, async (req, res) => {
      const productId = req.params.id
      const query = { productId: productId }

      const result = await reportsCollection.deleteOne(query)
      res.send(result)
    })

    //stat
    app.get('/stats', verifyToken, verifyAdmin, async (req, res) => {
     
        const users = await usersCollection.estimatedDocumentCount();
        const reviews = await reviewsCollection.estimatedDocumentCount();

        // Aggregation for totalProducts
        const totalProductsResult = await productsCollection.aggregate([
          {
            $match: {
              status: { $in: ["pending", "accepted"] }
            }
          },
          {
            $count: "totalProducts"
          }
        ]).toArray();


        const totalProducts = totalProductsResult.length > 0 ? totalProductsResult[0].totalProducts : 0;

        res.send({ users, reviews, totalProducts });
     
    });

// post coupons
app.post("/coupons",verifyToken,verifyAdmin, async (req, res) => {
  const { code, expiry, description, discount } = req.body;
    const newCoupon = {
      code,
      expiry: new Date(expiry), 
      description,
      discount: parseFloat(discount), 
    };
    const result = await couponsCollection.insertOne(newCoupon);
    res.send(result)
});

//  get all coupons
app.get("/coupons",verifyToken,verifyAdmin, async (req, res) => {

    const result = await couponsCollection.find().toArray();
    res.send(result)
 
});

//  delete a coupon
app.delete("/coupons/:id",verifyToken,verifyAdmin, async (req, res) => {
 
    const { id } = req.params;
    const query = { _id: new ObjectId(id) }
    const result = await couponsCollection.deleteOne(query);
   
    res.send(result)
   
});

//  update a coupon
app.put("/coupons/:id",verifyToken,verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const query = { _id: new ObjectId(id) }
  const { code, expiry, description, discount } = req.body;
    const updatedCoupon = {
      code,
      expiry: new Date(expiry),
      description,
      discount: parseFloat(discount),
    };

    const result = await couponsCollection
      .updateOne(query , { $set: updatedCoupon });

   
      res.send(result)

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
