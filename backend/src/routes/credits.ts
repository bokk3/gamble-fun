import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { executeQuery, executeTransaction } from '../config/database';
import { RowDataPacket } from 'mysql2';

const router = Router();

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  bonus: number;
}

const creditPackages: CreditPackage[] = [
  { id: 'starter', name: 'Starter Pack', credits: 100, price: 9.99, bonus: 0 },
  { id: 'popular', name: 'Popular Pack', credits: 500, price: 39.99, bonus: 50 },
  { id: 'premium', name: 'Premium Pack', credits: 1000, price: 69.99, bonus: 150 },
  { id: 'vip', name: 'VIP Pack', credits: 2500, price: 149.99, bonus: 500 }
];

/**
 * GET /api/credits/packages
 * Get available credit packages
 */
router.get('/packages', (req, res) => {
  res.json({
    success: true,
    message: 'Credit packages retrieved successfully',
    data: creditPackages
  });
});

/**
 * POST /api/credits/purchase
 * Process a credit purchase
 */
router.post('/purchase', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const { packageId, credits, amount, paymentMethod } = req.body;

    // Validate input
    if (!packageId || !credits || !amount || !paymentMethod) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
      return;
    }

    // Validate package (if not custom)
    let selectedPackage: CreditPackage | null = null;
    if (packageId !== 'custom') {
      selectedPackage = creditPackages.find(pkg => pkg.id === packageId) || null;
      if (!selectedPackage) {
        res.status(400).json({
          success: false,
          message: 'Invalid package selected'
        });
        return;
      }

      // Validate the credits and amount match the package
      const expectedCredits = selectedPackage.credits + selectedPackage.bonus;
      if (credits !== expectedCredits || amount !== selectedPackage.price) {
        res.status(400).json({
          success: false,
          message: 'Package details do not match'
        });
        return;
      }
    } else {
      // Custom package validation
      if (amount < 5 || amount > 1000) {
        res.status(400).json({
          success: false,
          message: 'Custom amount must be between $5 and $1000'
        });
        return;
      }

      const expectedCredits = Math.floor(amount * 10) + (amount >= 50 ? Math.floor(amount * 0.1) : 0);
      if (credits !== expectedCredits) {
        res.status(400).json({
          success: false,
          message: 'Credit calculation is incorrect'
        });
        return;
      }
    }

    // Get current user balance
    const [userResult] = await executeQuery(
      'SELECT balance FROM users WHERE id = ?',
      [userId]
    ) as RowDataPacket[];

    if (!userResult || userResult.length === 0) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    const currentBalance = parseFloat(userResult[0].balance);
    const newBalance = currentBalance + credits;

    // Here you would integrate with actual payment processor
    // For demo purposes, we'll simulate successful payment
    const paymentSuccess = await simulatePaymentProcessing(paymentMethod, amount);
    
    if (!paymentSuccess.success) {
      res.status(400).json({
        success: false,
        message: paymentSuccess.message || 'Payment processing failed'
      });
      return;
    }

    // Process the credit purchase in a transaction
    const queries = [
      {
        query: 'UPDATE users SET balance = balance + ? WHERE id = ?',
        params: [credits, userId]
      },
      {
        query: `INSERT INTO transactions 
                (user_id, type, amount, balance_before, balance_after, description) 
                VALUES (?, ?, ?, ?, ?, ?)`,
        params: [
          userId,
          'deposit',
          credits,
          currentBalance,
          newBalance,
          `Credit purchase: ${selectedPackage?.name || 'Custom amount'} - ${paymentMethod}`
        ]
      }
    ];

    // Add purchase record
    queries.push({
      query: `INSERT INTO credit_purchases 
              (user_id, package_id, package_name, credits_purchased, amount_paid, payment_method, payment_id)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [
        userId,
        packageId,
        selectedPackage?.name || 'Custom Amount',
        credits,
        amount,
        paymentMethod,
        paymentSuccess.transactionId
      ]
    });

    await executeTransaction(queries);

    res.json({
      success: true,
      message: `Successfully purchased ${credits} credits!`,
      data: {
        creditsAdded: credits,
        newBalance: newBalance,
        transactionId: paymentSuccess.transactionId,
        packageName: selectedPackage?.name || 'Custom Amount'
      }
    });

  } catch (error) {
    console.error('Error processing credit purchase:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process credit purchase'
    });
  }
});

/**
 * GET /api/credits/history
 * Get user's credit purchase history
 */
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 10;

    const [purchases] = await executeQuery(
      `SELECT 
        id,
        package_name as packageName,
        credits_purchased as creditsPurchased,
        amount_paid as amountPaid,
        payment_method as paymentMethod,
        created_at as createdAt
      FROM credit_purchases 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?`,
      [userId, Math.min(limit, 50)]
    ) as RowDataPacket[];

    res.json({
      success: true,
      message: 'Purchase history retrieved successfully',
      data: purchases
    });

  } catch (error) {
    console.error('Error getting purchase history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get purchase history'
    });
  }
});

/**
 * GET /api/credits/stats
 * Get user's credit statistics
 */
router.get('/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const [stats] = await executeQuery(
      `SELECT 
        COUNT(*) as totalPurchases,
        COALESCE(SUM(credits_purchased), 0) as totalCreditsLurchased,
        COALESCE(SUM(amount_paid), 0) as totalAmountSpent,
        MAX(created_at) as lastPurchase
      FROM credit_purchases 
      WHERE user_id = ?`,
      [userId]
    ) as RowDataPacket[];

    res.json({
      success: true,
      message: 'Credit statistics retrieved successfully',
      data: stats[0] || {
        totalPurchases: 0,
        totalCreditsPurchased: 0,
        totalAmountSpent: 0,
        lastPurchase: null
      }
    });

  } catch (error) {
    console.error('Error getting credit stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get credit statistics'
    });
  }
});

/**
 * Simulate payment processing (replace with actual payment processor)
 */
async function simulatePaymentProcessing(paymentMethod: string, amount: number): Promise<{success: boolean, message?: string, transactionId?: string}> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Simulate different payment method behaviors
  switch (paymentMethod) {
    case 'card':
      if (Math.random() > 0.05) { // 95% success rate
        return {
          success: true,
          transactionId: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
      } else {
        return {
          success: false,
          message: 'Card payment declined. Please check your card details.'
        };
      }
    
    case 'paypal':
      if (Math.random() > 0.02) { // 98% success rate
        return {
          success: true,
          transactionId: `pp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
      } else {
        return {
          success: false,
          message: 'PayPal payment failed. Please try again.'
        };
      }
    
    case 'crypto':
      if (Math.random() > 0.08) { // 92% success rate (slightly lower for demo)
        return {
          success: true,
          transactionId: `crypto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
      } else {
        return {
          success: false,
          message: 'Cryptocurrency payment confirmation timeout. Please try again.'
        };
      }
    
    case 'apple':
      if (Math.random() > 0.01) { // 99% success rate
        return {
          success: true,
          transactionId: `apple_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
      } else {
        return {
          success: false,
          message: 'Apple Pay authentication failed.'
        };
      }
    
    default:
      return {
        success: false,
        message: 'Unsupported payment method'
      };
  }
}

export default router;