import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { executeQuery } from '../config/database';

const router = Router();

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

// Register endpoint
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: error.details[0].message
      });
      return;
    }

    const { username, email, password } = value;

    // Check if user already exists
    const existingUser = await executeQuery(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUser.length > 0) {
      res.status(409).json({
        success: false,
        message: 'Username or email already exists'
      });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with welcome bonus
    const welcomeBonus = 500.00; // $500 welcome bonus
    const result = await executeQuery(
      'INSERT INTO users (username, email, password_hash, balance) VALUES (?, ?, ?, ?)',
      [username, email, passwordHash, welcomeBonus]
    );

    // Record the welcome bonus transaction
    await executeQuery(
      'INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)',
      [result.insertId, 'bonus', welcomeBonus, 0, welcomeBonus, 'Welcome bonus for new account']
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: result.insertId, 
        username, 
        email 
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: `🎉 Welcome to Gamble Fun Casino! You've received a $${welcomeBonus.toFixed(2)} welcome bonus!`,
      data: {
        token,
        user: {
          id: result.insertId,
          username,
          email,
          balance: welcomeBonus
        },
        bonus: {
          type: 'welcome',
          amount: welcomeBonus,
          message: `Welcome bonus of $${welcomeBonus.toFixed(2)} added to your account!`
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: error.details[0].message
      });
      return;
    }

    const { username, password } = value;

    // Find user
    const users = await executeQuery(
      'SELECT id, username, email, password_hash, balance, last_login, created_at FROM users WHERE username = ? AND is_active = TRUE',
      [username]
    );

    if (users.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
      return;
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
      return;
    }

    // Check for daily login bonus
    let loginBonus = null;
    const now = new Date();
    const lastLogin = user.last_login ? new Date(user.last_login) : null;
    const today = now.toDateString();
    const lastLoginDay = lastLogin ? lastLogin.toDateString() : null;

    // Award daily login bonus if it's a new day
    if (!lastLogin || lastLoginDay !== today) {
      const dailyBonusAmount = 50.00; // $50 daily login bonus
      const currentBalance = parseFloat(user.balance);
      const newBalance = currentBalance + dailyBonusAmount;

      // Update balance and last login
      await executeQuery(
        'UPDATE users SET balance = ?, last_login = ? WHERE id = ?',
        [newBalance, now, user.id]
      );

      // Record the daily bonus transaction
      await executeQuery(
        'INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)',
        [user.id, 'bonus', dailyBonusAmount, currentBalance, newBalance, 'Daily login bonus']
      );

      loginBonus = {
        type: 'daily',
        amount: dailyBonusAmount,
        message: `Daily login bonus of $${dailyBonusAmount.toFixed(2)} added to your account!`
      };

      user.balance = newBalance; // Update for response
    } else {
      // Just update last login time
      await executeQuery(
        'UPDATE users SET last_login = ? WHERE id = ?',
        [now, user.id]
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        email: user.email 
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    const responseMessage = loginBonus 
      ? `🎉 Welcome back! ${loginBonus.message}` 
      : 'Welcome back to Gamble Fun Casino!';

    res.json({
      success: true,
      message: responseMessage,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          balance: parseFloat(user.balance)
        },
        bonus: loginBonus
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

export { router as authRoutes };