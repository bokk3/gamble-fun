import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  bonus: number;
  popular?: boolean;
  value: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface BuyCreditsProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (amount: number) => void;
}

const BuyCreditsModal: React.FC<BuyCreditsProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, updateBalance } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState(1); // 1: Select Package, 2: Payment Method, 3: Processing

  const creditPackages: CreditPackage[] = [
    {
      id: 'starter',
      name: 'Starter Pack',
      credits: 100,
      price: 9.99,
      bonus: 0,
      value: 'Best for beginners'
    },
    {
      id: 'popular',
      name: 'Popular Pack',
      credits: 500,
      price: 39.99,
      bonus: 50,
      popular: true,
      value: 'Most popular choice'
    },
    {
      id: 'premium',
      name: 'Premium Pack',
      credits: 1000,
      price: 69.99,
      bonus: 150,
      value: 'Best value'
    },
    {
      id: 'vip',
      name: 'VIP Pack',
      credits: 2500,
      price: 149.99,
      bonus: 500,
      value: 'Maximum credits'
    }
  ];

  const paymentMethods: PaymentMethod[] = [
    {
      id: 'card',
      name: 'Credit/Debit Card',
      icon: '💳',
      description: 'Visa, MasterCard, American Express'
    },
    {
      id: 'paypal',
      name: 'PayPal',
      icon: '🅿️',
      description: 'Pay with your PayPal account'
    },
    {
      id: 'crypto',
      name: 'Cryptocurrency',
      icon: '₿',
      description: 'Bitcoin, Ethereum, and more'
    },
    {
      id: 'apple',
      name: 'Apple Pay',
      icon: '🍎',
      description: 'Quick and secure payment'
    }
  ];

  const handlePackageSelect = (pkg: CreditPackage) => {
    setSelectedPackage(pkg);
    setStep(2);
  };

  const handleCustomAmount = () => {
    const amount = parseFloat(customAmount);
    if (amount >= 5 && amount <= 1000) {
      const customPkg: CreditPackage = {
        id: 'custom',
        name: 'Custom Amount',
        credits: Math.floor(amount * 10), // $1 = 10 credits
        price: amount,
        bonus: amount >= 50 ? Math.floor(amount * 0.1) : 0,
        value: 'Custom amount'
      };
      setSelectedPackage(customPkg);
      setStep(2);
    }
  };

  const handlePaymentSelect = (payment: PaymentMethod) => {
    setSelectedPayment(payment);
    setStep(3);
  };

  const processPurchase = async () => {
    if (!selectedPackage || !selectedPayment) return;

    setProcessing(true);
    
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Here you would integrate with actual payment processor
      const response = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          packageId: selectedPackage.id,
          credits: selectedPackage.credits + selectedPackage.bonus,
          amount: selectedPackage.price,
          paymentMethod: selectedPayment.id
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update user balance
        if (user) {
          updateBalance(user.balance + selectedPackage.credits + selectedPackage.bonus);
        }
        
        onSuccess?.(selectedPackage.credits + selectedPackage.bonus);
        onClose();
        
        // Show success message
        alert(`Success! ${selectedPackage.credits + selectedPackage.bonus} credits added to your account!`);
      } else {
        throw new Error('Payment failed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const resetModal = () => {
    setStep(1);
    setSelectedPackage(null);
    setSelectedPayment(null);
    setCustomAmount('');
    setProcessing(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-casino-primary border border-casino-accent/50 rounded-xl max-w-4xl w-full max-h-96 overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-casino-accent/30 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">💰 Buy Credits</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-80">
          
          {/* Step 1: Select Package */}
          {step === 1 && (
            <div>
              <h3 className="text-xl font-bold text-white mb-6">Choose Your Credit Package</h3>
              
              {/* Credit Packages Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {creditPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    onClick={() => handlePackageSelect(pkg)}
                    className={`relative cursor-pointer border-2 rounded-lg p-4 transition-all hover:scale-105 ${
                      pkg.popular 
                        ? 'border-casino-gold bg-gradient-to-b from-casino-gold/20 to-casino-accent/20' 
                        : 'border-casino-accent/30 bg-casino-secondary hover:border-casino-accent'
                    }`}
                  >
                    {pkg.popular && (
                      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                        <span className="bg-casino-gold text-casino-primary px-3 py-1 rounded-full text-xs font-bold">
                          MOST POPULAR
                        </span>
                      </div>
                    )}
                    
                    <div className="text-center">
                      <h4 className="font-bold text-white text-lg">{pkg.name}</h4>
                      <div className="text-3xl font-bold text-casino-gold my-2">
                        ${pkg.credits.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-300 mb-2">Credits</div>
                      
                      {pkg.bonus > 0 && (
                        <div className="text-casino-green font-bold mb-2">
                          +{pkg.bonus} Bonus!
                        </div>
                      )}
                      
                      <div className="text-2xl font-bold text-white mb-2">
                        ${pkg.price}
                      </div>
                      
                      <div className="text-xs text-gray-400">
                        {pkg.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom Amount */}
              <div className="border-t border-casino-accent/30 pt-6">
                <h4 className="text-lg font-bold text-white mb-4">Or Enter Custom Amount</h4>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="5"
                      max="1000"
                      step="0.01"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="Enter amount ($5 - $1000)"
                      className="casino-input w-full"
                    />
                    <div className="text-xs text-gray-400 mt-1">
                      $1 = 10 credits • Orders $50+ get 10% bonus credits
                    </div>
                  </div>
                  <button
                    onClick={handleCustomAmount}
                    disabled={!customAmount || parseFloat(customAmount) < 5}
                    className="casino-button-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Payment Method */}
          {step === 2 && selectedPackage && (
            <div>
              <div className="flex items-center mb-6">
                <button
                  onClick={() => setStep(1)}
                  className="text-casino-accent hover:text-casino-gold mr-4"
                >
                  ← Back
                </button>
                <h3 className="text-xl font-bold text-white">Choose Payment Method</h3>
              </div>

              {/* Selected Package Summary */}
              <div className="bg-casino-secondary border border-casino-accent/30 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-white">{selectedPackage.name}</h4>
                    <p className="text-gray-300">
                      {selectedPackage.credits.toLocaleString()} credits
                      {selectedPackage.bonus > 0 && (
                        <span className="text-casino-green"> + {selectedPackage.bonus} bonus</span>
                      )}
                    </p>
                  </div>
                  <div className="text-2xl font-bold text-casino-gold">
                    ${selectedPackage.price}
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    onClick={() => handlePaymentSelect(method)}
                    className="cursor-pointer border border-casino-accent/30 rounded-lg p-4 hover:border-casino-accent hover:bg-casino-secondary/50 transition-all"
                  >
                    <div className="flex items-center">
                      <span className="text-3xl mr-4">{method.icon}</span>
                      <div>
                        <h4 className="font-bold text-white">{method.name}</h4>
                        <p className="text-sm text-gray-400">{method.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {step === 3 && selectedPackage && selectedPayment && (
            <div className="text-center">
              <div className="flex items-center mb-6">
                <button
                  onClick={() => setStep(2)}
                  disabled={processing}
                  className="text-casino-accent hover:text-casino-gold mr-4 disabled:opacity-50"
                >
                  ← Back
                </button>
                <h3 className="text-xl font-bold text-white">Confirm Purchase</h3>
              </div>

              {/* Purchase Summary */}
              <div className="bg-casino-secondary border border-casino-accent/30 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-bold text-white mb-4">Purchase Summary</h4>
                <div className="space-y-2 text-left">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Package:</span>
                    <span className="text-white">{selectedPackage.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Credits:</span>
                    <span className="text-white">{selectedPackage.credits.toLocaleString()}</span>
                  </div>
                  {selectedPackage.bonus > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-300">Bonus Credits:</span>
                      <span className="text-casino-green">+{selectedPackage.bonus}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-casino-accent/30 pt-2 mt-2">
                    <span className="text-gray-300">Total Credits:</span>
                    <span className="text-casino-gold font-bold">
                      {(selectedPackage.credits + selectedPackage.bonus).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Payment Method:</span>
                    <span className="text-white">{selectedPayment.name}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold border-t border-casino-accent/30 pt-2 mt-2">
                    <span className="text-white">Total:</span>
                    <span className="text-casino-gold">${selectedPackage.price}</span>
                  </div>
                </div>
              </div>

              {/* Process Payment Button */}
              <button
                onClick={processPurchase}
                disabled={processing}
                className="casino-button-primary px-8 py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    Processing Payment...
                  </div>
                ) : (
                  `Complete Purchase - $${selectedPackage.price}`
                )}
              </button>

              {processing && (
                <p className="text-gray-400 text-sm mt-4">
                  Please wait while we process your payment...
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuyCreditsModal;