import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

interface Feature {
  id: number;
  title: string;
  description: string;
  icon: string;
}

interface PricingTier {
  name: string;
  price: number;
  features: string[];
  highlighted?: boolean;
}

// ============================================================================
// Static Data (hoisted outside component per vercel best practices)
// ============================================================================

const features: Feature[] = [
  { id: 1, title: 'Fast Performance', description: 'Lightning fast load times', icon: '⚡' },
  { id: 2, title: 'Secure', description: 'Enterprise-grade security', icon: '🔒' },
  { id: 3, title: 'Scalable', description: 'Grows with your business', icon: '📈' },
  { id: 4, title: 'Support', description: '24/7 customer support', icon: '💬' },
];

const pricingTiers: PricingTier[] = [
  { name: 'Starter', price: 9, features: ['1 User', '10GB Storage', 'Email Support'] },
  { name: 'Pro', price: 29, features: ['5 Users', '100GB Storage', 'Priority Support', 'API Access'], highlighted: true },
  { name: 'Enterprise', price: 99, features: ['Unlimited Users', '1TB Storage', '24/7 Support', 'Custom Integrations'] },
];

// ============================================================================
// Utility: cn (clsx + tailwind-merge pattern)
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ============================================================================
// Component
// ============================================================================

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeFeature, setActiveFeature] = useState<number | null>(null);

  // Scroll listener with passive option (vercel: client-passive-event-listeners)
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    // Add passive: true since we don't call preventDefault()
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Submitted:', email);
    setEmail('');
  }, [email]);

  const handleFeatureSelect = useCallback((id: number) => {
    setActiveFeature(id);
  }, []);

  const handleFeatureKeyDown = useCallback((e: React.KeyboardEvent, id: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setActiveFeature(id);
    }
  }, []);

  return (
    <div className="font-sans antialiased">
      {/* Skip Link (rams: accessibility) */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:outline-none"
      >
        Skip to content
      </a>

      {/* Header (ui-skills: safe-area-inset, fixed z-index scale, no backdrop-filter) */}
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-40 transition-colors duration-200',
          'pt-[env(safe-area-inset-top)]',
          isScrolled ? 'bg-white/95 shadow-sm' : 'bg-transparent'
        )}
      >
        <nav className="flex items-center justify-between max-w-5xl mx-auto px-6 py-4">
          {/* Logo as link (rams: accessibility) */}
          <a href="/" className="text-2xl font-bold text-gray-900 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded">
            MCP Hub
          </a>

          {/* Nav Links with focus states (rams: focus indication) */}
          <div className="hidden sm:flex gap-6">
            <a
              href="#features"
              className="text-gray-700 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded px-1"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-gray-700 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded px-1"
            >
              Pricing
            </a>
            <a
              href="#contact"
              className="text-gray-700 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded px-1"
            >
              Contact
            </a>
          </div>

          {/* Button with focus state (rams: visible focus) */}
          <button
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-colors duration-150"
          >
            Get Started
          </button>
        </nav>
      </header>

      {/* Main content landmark (rams: accessibility) */}
      <main id="main">
        {/* Hero Section (ui-skills: no purple gradient, min-h-dvh, text-balance) */}
        <section className="min-h-dvh flex flex-col items-center justify-center text-center px-6 pt-32 pb-20 bg-indigo-600 text-white">
          <h1 className="text-4xl sm:text-5xl font-bold mb-6 text-balance max-w-3xl">
            Your AI Infrastructure Hub
          </h1>
          <p className="text-lg sm:text-xl max-w-2xl mb-8 text-indigo-100 text-pretty">
            Connect, manage, and scale your MCP servers with ease. Built for developers who demand the best.
          </p>

          {/* Form with labeled input (rams: form accessibility) */}
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
            <label htmlFor="email-input" className="sr-only">
              Email address
            </label>
            <input
              id="email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              aria-label="Email address"
              className="flex-1 px-5 py-3 text-base text-gray-900 rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-gray-900 text-white font-semibold rounded-md hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600 transition-colors duration-150"
            >
              Join Waitlist
            </button>
          </form>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 px-6 bg-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12 text-balance">
              Why Choose MCP Hub?
            </h2>

            {/* Feature cards (rams: keyboard accessible, vercel: removed unnecessary filter) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature) => (
                <div
                  key={feature.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleFeatureSelect(feature.id)}
                  onKeyDown={(e) => handleFeatureKeyDown(e, feature.id)}
                  className={cn(
                    'p-6 rounded-lg cursor-pointer transition-colors duration-150',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                    activeFeature === feature.id ? 'bg-indigo-100' : 'bg-gray-100 hover:bg-gray-200'
                  )}
                >
                  {/* Icon with aria-hidden (rams: decorative images) */}
                  <span role="img" aria-hidden="true" className="text-3xl">
                    {feature.icon}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-gray-600">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section (ui-skills: tabular-nums for prices) */}
        <section id="pricing" className="py-20 px-6 bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12 text-balance">
              Simple, Transparent Pricing
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {pricingTiers.map((tier) => (
                <div
                  key={tier.name}
                  className={cn(
                    'p-8 rounded-xl bg-white',
                    tier.highlighted
                      ? 'shadow-lg ring-2 ring-indigo-600 scale-105'
                      : 'shadow-md'
                  )}
                >
                  <h3 className="text-2xl font-semibold text-gray-900">
                    {tier.name}
                  </h3>
                  <div className="mt-4">
                    {/* Tabular nums for price alignment (ui-skills: typography) */}
                    <span className="text-5xl font-bold tabular-nums text-gray-900">
                      ${tier.price}
                    </span>
                    <span className="text-gray-600">/month</span>
                  </div>

                  <ul className="mt-6 space-y-3">
                    {tier.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2 py-2 border-b border-gray-100 text-gray-700"
                      >
                        <span className="text-indigo-600" aria-hidden="true">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* Consistent button styling (rams: button states) */}
                  <button
                    className={cn(
                      'w-full mt-6 px-6 py-3 font-semibold rounded-md transition-colors duration-150',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
                      tier.highlighted
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-white text-indigo-600 border-2 border-indigo-600 hover:bg-indigo-50'
                    )}
                  >
                    {tier.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer (rams: real links, proper contrast) */}
      <footer id="contact" className="py-12 px-6 bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto text-center">
          <div className="text-2xl font-bold mb-4">MCP Hub</div>
          <p className="text-gray-400 mb-6">
            Built with love for the AI developer community
          </p>

          {/* Real links instead of # (rams: link destination) */}
          <div className="flex justify-center gap-6 mb-8">
            <a
              href="https://twitter.com/mcphub"
              className="text-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded transition-colors duration-150"
            >
              Twitter
            </a>
            <a
              href="https://github.com/mcphub"
              className="text-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded transition-colors duration-150"
            >
              GitHub
            </a>
            <a
              href="https://discord.gg/mcphub"
              className="text-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded transition-colors duration-150"
            >
              Discord
            </a>
          </div>

          {/* Better contrast for small text (rams: 4.5:1 ratio) */}
          <p className="text-gray-500 text-sm">
            © 2024 MCP Hub. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
