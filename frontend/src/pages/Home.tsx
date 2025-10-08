import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Home: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  
  const testimonials = [
    { name: "Alex M.", text: "Won $2,500 on slots! The provably fair system gives me confidence.", game: "Fortune Teller Slots" },
    { name: "Sarah K.", text: "Love the roulette game, hit a 36x win yesterday!", game: "European Roulette" },
    { name: "Mike R.", text: "Daily bonuses keep me coming back. Great casino experience!", game: "Blackjack 21" },
    { name: "Emma L.", text: "The auto-spin feature on slots is amazing. Hit multiple jackpots!", game: "Fortune Teller Slots" }
  ];

  const features = [
    { icon: "🔒", title: "Provably Fair", desc: "Every game result is cryptographically verifiable" },
    { icon: "💰", title: "$500 Welcome Bonus", desc: "Get started with free credits on registration" },
    { icon: "💎", title: "Daily Bonuses", desc: "$50 free credits every day you log in" },
    { icon: "🎰", title: "5 Casino Games", desc: "Slots, Roulette, Blackjack, Dice, and Crash" },
    { icon: "🏆", title: "Real-Time Leaderboards", desc: "Compete with other players for top wins" },
    { icon: "🔊", title: "Immersive Audio", desc: "Full sound effects and casino atmosphere" }
  ];

  const games = [
    { 
      name: "Fortune Teller Slots", 
      icon: "🔮", 
      desc: "5x3 mystical slot machine with 20 paylines and auto-spin",
      maxWin: "300x"
    },
    { 
      name: "European Roulette", 
      icon: "🎯", 
      desc: "Classic 37-number roulette with all betting options",
      maxWin: "36x"
    },
    { 
      name: "Blackjack 21", 
      icon: "🃏", 
      desc: "Beat the dealer with perfect basic strategy",
      maxWin: "3:2"
    },
    { 
      name: "Dice Roll", 
      icon: "🎲", 
      desc: "Predict over/under with customizable multipliers",
      maxWin: "99x"
    },
    { 
      name: "Crash Game", 
      icon: "🚀", 
      desc: "Cash out before the rocket crashes",
      maxWin: "1000x"
    }
  ];

  // Rotate testimonials every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [testimonials.length]);
  
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-75"></div>
          <div className="absolute top-40 left-1/2 w-80 h-80 bg-pink-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-150"></div>
        </div>

        <div className="relative container mx-auto px-4 py-16 flex flex-col justify-center min-h-screen">
          <div className="text-center max-w-4xl mx-auto">
            {/* Logo and Title */}
            <div className="mb-8">
              <div className="text-8xl mb-4 animate-bounce">🎰</div>
              <h1 className="text-6xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 mb-4">
                Gamble Fun Casino
              </h1>
              <p className="text-2xl text-white opacity-90 mb-2">
                The Ultimate Provably Fair Gaming Experience
              </p>
              <p className="text-lg text-purple-200 opacity-75">
                Join thousands of players winning real money with cryptographically verified games
              </p>
            </div>

            {/* Welcome Bonus Banner */}
            <div className="bg-gradient-to-r from-green-600/30 to-yellow-600/30 border-2 border-green-400 rounded-2xl p-6 mb-8 backdrop-blur-sm">
              <div className="text-4xl mb-2">🎁</div>
              <h2 className="text-3xl font-bold text-green-400 mb-2">$500 Welcome Bonus!</h2>
              <p className="text-green-200 text-lg">Plus $50 daily login rewards!</p>
            </div>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-4 px-8 rounded-xl text-xl transition-all duration-300 transform hover:scale-105 shadow-2xl"
                >
                  🎯 Enter Casino
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-4 px-8 rounded-xl text-xl transition-all duration-300 transform hover:scale-105 shadow-2xl"
                  >
                    🎉 Join Now & Get $500!
                  </Link>
                  <Link
                    to="/login"
                    className="bg-white bg-opacity-10 backdrop-blur-sm hover:bg-opacity-20 text-white font-bold py-4 px-8 rounded-xl border-2 border-white border-opacity-30 transition-all duration-300 text-xl"
                  >
                    🔑 Login
                  </Link>
                </>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-2xl font-bold text-yellow-400">5+</div>
                <div className="text-sm text-gray-300">Casino Games</div>
              </div>
              <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-2xl font-bold text-green-400">$500</div>
                <div className="text-sm text-gray-300">Welcome Bonus</div>
              </div>
              <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-2xl font-bold text-blue-400">24/7</div>
                <div className="text-sm text-gray-300">Play Anytime</div>
              </div>
              <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-2xl font-bold text-purple-400">100%</div>
                <div className="text-sm text-gray-300">Provably Fair</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gradient-to-br from-gray-900 to-purple-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Why Choose Gamble Fun Casino?</h2>
            <p className="text-xl text-gray-300">Experience the future of online gambling</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 border border-white border-opacity-20 hover:border-yellow-400 transition-all duration-300 transform hover:scale-105">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-300">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Games Section */}
      <section className="py-20 bg-gradient-to-br from-purple-900 to-indigo-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Featured Casino Games</h2>
            <p className="text-xl text-gray-300">All games are provably fair and cryptographically verified</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {games.slice(0, 3).map((game, index) => (
              <div key={index} className="bg-gradient-to-br from-yellow-600/20 to-orange-600/20 border-2 border-yellow-500/30 rounded-xl p-6 hover:border-yellow-400 transition-all duration-300 transform hover:scale-105">
                <div className="text-5xl mb-4 text-center">{game.icon}</div>
                <h3 className="text-2xl font-bold text-yellow-400 mb-2 text-center">{game.name}</h3>
                <p className="text-gray-300 mb-4 text-center">{game.desc}</p>
                <div className="text-center">
                  <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                    Max Win: {game.maxWin}
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 transform hover:scale-105"
              >
                🎮 Play All Games
              </Link>
            ) : (
              <Link
                to="/register"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 transform hover:scale-105"
              >
                🎮 Start Playing Now
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-gradient-to-br from-indigo-900 to-blue-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">What Players Say</h2>
            <p className="text-xl text-gray-300">Join our community of winners</p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-8 border border-white border-opacity-20">
              <div className="text-center">
                <div className="text-4xl mb-4">💬</div>
                <blockquote className="text-xl text-white mb-4 italic">
                  "{testimonials[currentTestimonial].text}"
                </blockquote>
                <div className="text-yellow-400 font-bold">- {testimonials[currentTestimonial].name}</div>
                <div className="text-gray-400 text-sm">Playing {testimonials[currentTestimonial].game}</div>
              </div>
            </div>
            
            {/* Testimonial indicators */}
            <div className="flex justify-center mt-6 space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentTestimonial ? 'bg-yellow-400' : 'bg-gray-600'
                  }`}
                  onClick={() => setCurrentTestimonial(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-br from-yellow-600 to-orange-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-black mb-4">Ready to Win Big?</h2>
          <p className="text-xl text-black opacity-80 mb-8">
            Join Gamble Fun Casino today and start your winning journey!
          </p>
          
          {!isAuthenticated && (
            <Link
              to="/register"
              className="bg-black hover:bg-gray-800 text-white font-bold py-4 px-12 rounded-xl text-xl transition-all duration-300 transform hover:scale-105 shadow-2xl"
            >
              🚀 Get Your $500 Bonus Now!
            </Link>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;