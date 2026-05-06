const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { router: authRoutes } = require('./routes/authRoutes');
const goalRoutes = require('./routes/goalRoutes');
const aiRoutes = require('./routes/aiRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/user', userRoutes);

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
