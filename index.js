require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion} = require('mongodb')
const jwt = require('jsonwebtoken')
const morgan = require('morgan')

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
  //get users data from db

  app.get('/users', verifyToken, async (req, res) => {

    const result = await usersCollection.find().toArray()
    res.send(result)
  })
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
