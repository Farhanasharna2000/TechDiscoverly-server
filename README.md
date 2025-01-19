# 🌐 TechDiscoverly Backend

The backend for **TechDiscoverly**, a platform where users can discover, share, and review their favorite tech products. This backend handles user authentication, product management, role-based access control, and integration with third-party services like Stripe.

---

## 🛠️ Technologies Used

- **Node.js**: JavaScript runtime for building scalable backend applications.
- **Express.js**: Web framework for building the server-side RESTful API.
- **MongoDB**: NoSQL database for storing user data, product listings, and reviews.
- **Stripe**: Payment gateway integration for managing subscriptions and payments.
- **JWT (jsonwebtoken)**: Secure user authentication and role management.
- **dotenv**: Manage environment variables securely.
- **Moment.js**: Simplify date and time manipulation.
- **Morgan**: HTTP request logger for better debugging and monitoring.

---

## ✨ Features

1. **User Authentication**:
   - Secure login and registration using JWT.
   - Role-based access control for normal users, moderators, and admins.

2. **Product Management**:
   - Create, read, update, and delete product listings.
   - Product moderation features for admins and moderators.

3. **Payment Integration**:
   - Handle subscriptions and payments using Stripe.

4. **Logging**:
   - HTTP request logging for development and debugging with Morgan.

5. **Scalable Data Handling**:
   - Efficient data storage and querying using MongoDB.

---

## 📦 Dependencies

- **`cors`**: Middleware to enable cross-origin resource sharing.
- **`dotenv`**: Load environment variables from `.env` files.
- **`express`**: Fast and minimalist web framework.
- **`jsonwebtoken`**: Secure user authentication with JSON Web Tokens.
- **`moment`**: Simplified date and time manipulation.
- **`mongodb`**: MongoDB driver for database operations.
- **`morgan`**: HTTP request logger.
- **`stripe`**: Payment gateway integration.

---

## 💻 How to Run the Backend

Follow these steps to set up and run the backend for TechDiscoverly:

### 1. Clone the Repository
Clone the backend repository to your local machine:
```bash
git clone https://github.com/Programming-Hero-Web-Course4/b10a12-server-side-Farhanasharna2000
cd b10a12-server-side-Farhanasharna2000
