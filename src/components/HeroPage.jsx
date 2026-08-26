import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Camera, Search, X, Upload, ArrowUp, Zap, Database, Shield, Code, BarChart3, Globe } from 'lucide-react';
import { useImageSearch } from './ImageSearchContext';
import { useDashboardAuth } from '../dashboard/DashboardLayout';

// Search categories for the unified search system
const searchCategories = [
  { id: 'products', label: 'Products', icon: '◇' },
  { id: 'documents', label: 'Documents', icon: '◎' },
  { id: 'images', label: 'Images', icon: '◉' },
];

// Example search suggestions that rotate
const searchExamples = [
  'Find sustainable home office products',
  'Wireless earbuds with long battery life',
  'Minimalist desk accessories under $50',
  'Ergonomic chairs for back support',
  'Tech gadgets for remote work',
  'Premium noise-canceling headphones',
];

// Feature highlights for SaaS
const features = [
  {
    title: 'Semantic Understanding',
    description: 'Our AI understands context and meaning, not just keywords. Search naturally, get intelligent results.',
    icon: Zap,
  },
  {
    title: 'Multi-tenant Architecture',
    description: 'Isolated data per tenant with enterprise-grade security. Perfect for SaaS applications.',
    icon: Shield,
  },
  {
    title: 'Vector Intelligence',
    description: 'Built on Cohere embeddings and Pinecone infrastructure for blazing-fast semantic search.',
    icon: Database,
  },
  {
    title: 'Simple API',
    description: 'REST API with SDKs for JavaScript, Python, and more. Integrate in minutes, not days.',
    icon: Code,
  },
  {
    title: 'Analytics Dashboard',
    description: 'Track search patterns, popular queries, and user behavior with built-in analytics.',
    icon: BarChart3,
  },
  {
    title: 'Global Infrastructure',
    description: 'Deployed on edge networks worldwide for sub-100ms latency anywhere.',
    icon: Globe,
  },
];

// Trusted by logos (placeholder representations)
const trustedBy = ['Y Combinator', 'Vercel', 'Stripe', 'Notion', 'Linear'];

const HeroPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [activeCategory, setActiveCategory] = useState('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [mode, setMode] = useState('camera'); // 'camera', 'image', or 'search'
  const [isDragOver, setIsDragOver] = useState(false);
  const [glowActive, setGlowActive] = useState(false);
  const { selectedImage, setSelectedImage } = useImageSearch();
  
  // Check if user is logged in
  const { tenant } = useDashboardAuth();

  // Rotate placeholder text
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % searchExamples.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Search logic
  const handleSearch = (e) => {
    e.preventDefault();
    if (mode === 'search' && searchQuery.trim()) {
      setGlowActive(true);
      setTimeout(() => {
        navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      }, 50);
    } else if (selectedImage) {
      setGlowActive(true);
      setTimeout(() => {
        navigate(`/search?image=true`);
      }, 50);
    }
  };

  // Handle right button click
  const handleRightButtonClick = (e) => {
    if (mode === 'camera') {
      setGlowActive(true);
      setMode('image');
      setSearchQuery('');
      setSelectedImage(null);
    } else if (mode === 'image' && selectedImage) {
      handleSearch(e);
    } else if (mode === 'image') {
      setMode('camera');
      setSelectedImage(null);
      setSearchQuery('');
    } else if (mode === 'search' && searchQuery.length > 0) {
      handleSearch(e);
    }
  };

  // When file is uploaded
  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleImageUpload(file);
      setMode('image');
    }
  };

  // When user types
  const handleSearchInputChange = (e) => {
    setSearchQuery(e.target.value);
    if (e.target.value.length > 0 && mode !== 'search') setMode('search');
    if (e.target.value.length === 0 && mode === 'search') setMode('camera');
    if (!glowActive && e.target.value.length > 0) {
      setGlowActive(true);
    }
  };

  const handleImageUpload = (file) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage({
          file: file,
          preview: e.target.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageUpload(files[0]);
      setMode('image');
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1A1A1A] antialiased">
      {/* Top Navigation - Slim, minimal */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAFA]/90 backdrop-blur-md border-b border-[#E5E5E5]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Search className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">Searchy</span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-sm text-[#666] hover:text-[#1A1A1A] transition-colors duration-200">
              Features
            </a>
            <a href="#demo" className="text-sm text-[#666] hover:text-[#1A1A1A] transition-colors duration-200">
              Demo
            </a>
            <a href="#pricing" className="text-sm text-[#666] hover:text-[#1A1A1A] transition-colors duration-200">
              Pricing
            </a>
            <a href="https://docs.searchy.ai" target="_blank" rel="noopener noreferrer" className="text-sm text-[#666] hover:text-[#1A1A1A] transition-colors duration-200">
              Docs
            </a>
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center space-x-3">
            {tenant ? (
              // User is logged in
              <Link 
                to="/dashboard" 
                className="text-sm bg-[#1A1A1A] text-white px-4 py-2 rounded-lg hover:bg-[#333] transition-colors duration-200 flex items-center space-x-2"
              >
                <span>Dashboard</span>
                <ArrowUp className="w-3.5 h-3.5 rotate-45" />
              </Link>
            ) : (
              // User is not logged in
              <>
                <Link 
                  to="/dashboard/login" 
                  className="text-sm text-[#666] hover:text-[#1A1A1A] transition-colors duration-200 hidden sm:block"
                >
                  Sign in
                </Link>
                <Link 
                  to="/dashboard/login?mode=register" 
                  className="text-sm bg-[#1A1A1A] text-white px-4 py-2 rounded-lg hover:bg-[#333] transition-colors duration-200"
                >
                  Get started free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 bg-white border border-[#E5E5E5] rounded-full px-4 py-1.5 mb-8 shadow-sm">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-xs text-[#666] font-medium">Now in public beta • Free to start</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.1] mb-6">
            AI-powered search
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">for your SaaS</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-[#666] max-w-2xl mx-auto mb-12 leading-relaxed">
            Add semantic search to any application in minutes.
            <br className="hidden md:block" />
            Multi-tenant, secure, and infinitely scalable.
          </p>

          {/* Category Toggle - Secondary Navigation */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center bg-white border border-[#E5E5E5] rounded-full p-1 shadow-sm">
              {searchCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`flex items-center space-x-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${activeCategory === category.id
                      ? 'bg-[#1A1A1A] text-white shadow-md'
                      : 'text-[#666] hover:text-[#1A1A1A]'
                    }`}
                >
                  <span className="text-xs">{category.icon}</span>
                  <span>{category.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar - The Hero Element */}
          <div id="demo" className="max-w-2xl mx-auto">
            <form onSubmit={handleSearch}>
              <div
                className={`relative bg-white rounded-2xl border-2 transition-all duration-300 shadow-lg ${isSearchFocused || glowActive
                    ? 'border-[#1A1A1A] shadow-xl shadow-black/5'
                    : isDragOver
                      ? 'border-blue-400 shadow-xl shadow-blue-500/10'
                      : 'border-[#E5E5E5] hover:border-[#CCC]'
                  }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* Left Icon - Search or Upload */}
                <div className="absolute left-5 top-1/2 -translate-y-1/2">
                  {mode === 'image' ? (
                    <Upload
                      className={`w-5 h-5 transition-colors duration-200 ${isDragOver ? 'text-blue-500' : 'text-[#999]'
                        }`}
                    />
                  ) : (
                    <Search
                      className={`w-5 h-5 transition-colors duration-200 ${isSearchFocused ? 'text-[#1A1A1A]' : 'text-[#999]'
                        }`}
                    />
                  )}
                </div>

                {/* Text Search Input (camera/search mode) */}
                {(mode === 'camera' || mode === 'search') && (
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    placeholder={searchExamples[placeholderIndex]}
                    className="w-full pl-14 pr-32 py-5 text-lg bg-transparent outline-none placeholder:text-[#BBB] transition-all duration-200 rounded-2xl"
                  />
                )}

                {/* Image Upload Area (image mode) */}
                {mode === 'image' && (
                  <div className="w-full pl-14 pr-32 py-5 min-h-[66px] flex items-center">
                    {selectedImage ? (
                      <div className="flex items-center space-x-3">
                        <img
                          src={selectedImage.preview}
                          alt="Selected"
                          className="w-10 h-10 object-cover rounded-lg border border-[#E5E5E5]"
                        />
                        <span className="text-sm text-[#666] truncate max-w-[200px]">
                          {selectedImage.file.name}
                        </span>
                        <button
                          type="button"
                          onClick={clearImage}
                          className="p-1 rounded-full hover:bg-[#F0F0F0] transition-colors"
                        >
                          <X className="w-4 h-4 text-[#999] hover:text-[#666]" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3 text-[#999]">
                        <span className="text-base">
                          {isDragOver ? 'Drop image here' : 'Drag & drop an image'}
                        </span>
                        <span className="text-[#CCC]">or</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileInput}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[#1A1A1A] hover:text-[#666] text-base font-medium transition-colors"
                        >
                          browse
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Right Action Button */}
                <button
                  type={(mode === 'search' && searchQuery.length > 0) || (mode === 'image' && selectedImage) ? 'submit' : 'button'}
                  onClick={handleRightButtonClick}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${mode === 'camera'
                      ? 'bg-[#F0F0F0] text-[#666] hover:bg-[#E5E5E5]'
                      : (mode === 'search' && searchQuery.length > 0) || (mode === 'image' && selectedImage)
                        ? 'bg-[#1A1A1A] text-white hover:bg-[#333]'
                        : 'bg-[#F0F0F0] text-[#666] hover:bg-[#E5E5E5]'
                    }`}
                  aria-label={
                    mode === 'camera' ? 'Switch to image search' :
                      mode === 'image' && selectedImage ? 'Submit image search' :
                        mode === 'image' ? 'Switch to text search' :
                          'Submit search'
                  }
                >
                  {mode === 'camera' ? (
                    <>
                      <Camera className="w-4 h-4" />
                      <span className="hidden sm:inline">Image</span>
                    </>
                  ) : mode === 'image' && selectedImage ? (
                    <>
                      <span>Search</span>
                      <ArrowUp className="w-4 h-4" />
                    </>
                  ) : mode === 'image' ? (
                    <>
                      <Search className="w-4 h-4" />
                      <span className="hidden sm:inline">Text</span>
                    </>
                  ) : (
                    <>
                      <span>Search</span>
                      <ArrowUp className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Search Hint */}
            <p className="text-xs text-[#999] mt-4">
              {mode === 'image'
                ? 'Upload an image to search visually • Supports JPG, PNG, WebP'
                : 'Try: "cozy mystery films" • "designers who work remotely" • "minimal desk accessories"'
              }
            </p>
          </div>
        </div>
      </section>

      {/* Visual Demo Section - Device Mockup */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="relative bg-white rounded-3xl border border-[#E5E5E5] shadow-2xl shadow-black/5 overflow-hidden">
            {/* Browser Chrome */}
            <div className="flex items-center space-x-2 px-4 py-3 border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <div className="flex space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-[#FF5F57]"></div>
                <div className="w-3 h-3 rounded-full bg-[#FFBD2E]"></div>
                <div className="w-3 h-3 rounded-full bg-[#28CA41]"></div>
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-[#F0F0F0] rounded-lg px-4 py-1 text-xs text-[#999] font-mono">
                  api.searchy.ai/v1/search
                </div>
              </div>
            </div>

            {/* Demo Content */}
            <div className="p-8 md:p-12">
              <div className="grid md:grid-cols-3 gap-6">
                {/* Results Preview */}
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-[#FAFAFA] rounded-xl p-5 border border-[#E5E5E5] hover:border-[#CCC] transition-colors duration-200"
                  >
                    <div className="w-full h-32 bg-gradient-to-br from-[#F0F0F0] to-[#E5E5E5] rounded-lg mb-4"></div>
                    <div className="h-4 bg-[#E5E5E5] rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-[#F0F0F0] rounded w-full mb-1"></div>
                    <div className="h-3 bg-[#F0F0F0] rounded w-5/6"></div>
                    <div className="flex items-center justify-between mt-4">
                      <div className="h-3 bg-emerald-100 text-emerald-600 rounded px-2 py-0.5 text-xs font-medium">
                        98% match
                      </div>
                      <div className="h-3 bg-[#F0F0F0] rounded w-16"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="py-16 px-6 border-t border-[#E5E5E5]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-[#999] uppercase tracking-widest mb-8">Trusted by teams at</p>
          <div className="flex items-center justify-center flex-wrap gap-8 md:gap-12">
            {trustedBy.map((company) => (
              <span key={company} className="text-xl font-semibold text-[#CCC] hover:text-[#999] transition-colors duration-200">
                {company}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
              Everything you need for search
            </h2>
            <p className="text-[#666] max-w-lg mx-auto">
              From prototype to production in minutes. No ML expertise required.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-8 rounded-2xl border border-[#E5E5E5] hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 bg-[#FAFAFA]"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-3">{feature.title}</h3>
                <p className="text-[#666] text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 border-t border-[#E5E5E5]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
              How it works
            </h2>
            <p className="text-[#666] max-w-lg mx-auto">
              Three simple steps to intelligent search
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              { step: '01', title: 'Create Index', desc: 'Define your schema with our visual builder or API. Support for text, images, and structured data.' },
              { step: '02', title: 'Ingest Data', desc: 'Push records via REST API. We automatically generate embeddings with Cohere AI.' },
              { step: '03', title: 'Search', desc: 'Query with text or images. Get semantic results ranked by meaning, not keywords.' },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="text-5xl font-light bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">{item.step}</div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-[#666] text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Example Section */}
      <section className="py-24 px-6 bg-[#1A1A1A] text-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
                Simple, powerful API
              </h2>
              <p className="text-[#999] mb-8">
                Integrate semantic search with just a few lines of code. Works with any language or framework.
              </p>
              <Link
                to="/dashboard/login?mode=register"
                className="inline-flex items-center space-x-2 bg-white text-[#1A1A1A] px-6 py-3 rounded-xl font-medium hover:bg-[#F0F0F0] transition-colors duration-200"
              >
                <span>Get your API key</span>
                <ArrowUp className="w-4 h-4 rotate-45" />
              </Link>
            </div>
            <div className="bg-[#2A2A2A] rounded-2xl p-6 font-mono text-sm overflow-x-auto">
              <div className="text-[#888] mb-2">// Search with natural language</div>
              <div className="text-emerald-400">const</div>{' '}
              <span className="text-purple-400">results</span>{' '}
              <span className="text-white">=</span>{' '}
              <span className="text-emerald-400">await</span>{' '}
              <span className="text-blue-400">fetch</span>
              <span className="text-white">(</span>
              <span className="text-amber-300">'https://api.searchy.ai/v1/search'</span>
              <span className="text-white">, {'{'}</span>
              <div className="ml-4 text-white">method: <span className="text-amber-300">'POST'</span>,</div>
              <div className="ml-4 text-white">headers: {'{'}</div>
              <div className="ml-8 text-white"><span className="text-amber-300">'X-API-Key'</span>: <span className="text-purple-400">apiKey</span>,</div>
              <div className="ml-8 text-white"><span className="text-amber-300">'Content-Type'</span>: <span className="text-amber-300">'application/json'</span></div>
              <div className="ml-4 text-white">{'}'},</div>
              <div className="ml-4 text-white">body: <span className="text-blue-400">JSON</span>.<span className="text-blue-400">stringify</span>({'{'}</div>
              <div className="ml-8 text-white">index: <span className="text-amber-300">'products'</span>,</div>
              <div className="ml-8 text-white">query: <span className="text-amber-300">'ergonomic chairs for back pain'</span>,</div>
              <div className="ml-8 text-white">top_k: <span className="text-purple-400">10</span></div>
              <div className="ml-4 text-white">{'}'})</div>
              <span className="text-white">{'}'});</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6 bg-[#FAFAFA]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-[#666] max-w-lg mx-auto">
              Start free, scale as you grow. No credit card required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { name: 'Free', price: '$0', desc: 'For side projects', features: ['10K searches/mo', '1 index', '10K records', 'Community support', 'Basic analytics'] },
              { name: 'Pro', price: '$49', desc: 'For growing teams', features: ['100K searches/mo', '10 indices', '1M records', 'Priority support', 'Advanced analytics', 'Webhooks'], featured: true },
              { name: 'Enterprise', price: 'Custom', desc: 'For large organizations', features: ['Unlimited searches', 'Unlimited indices', 'Unlimited records', 'Dedicated support', 'SLA guarantee', 'Custom integrations'] },
            ].map((plan, index) => (
              <div
                key={index}
                className={`p-8 rounded-2xl ${plan.featured
                    ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-2xl shadow-indigo-500/30 scale-105'
                    : 'bg-white border border-[#E5E5E5]'
                  }`}
              >
                <div className={`text-sm font-medium mb-2 ${plan.featured ? 'text-indigo-200' : 'text-[#999]'}`}>{plan.name}</div>
                <div className="text-4xl font-semibold mb-1">{plan.price}</div>
                <div className={`text-sm mb-6 ${plan.featured ? 'text-indigo-200' : 'text-[#999]'}`}>{plan.desc}</div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center text-sm">
                      <svg className={`w-4 h-4 mr-2 ${plan.featured ? 'text-indigo-200' : 'text-indigo-600'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.name === 'Enterprise' ? '#contact' : '/dashboard/login?mode=register'}
                  className={`block w-full py-3 rounded-xl font-medium transition-colors duration-200 text-center ${plan.featured
                      ? 'bg-white text-indigo-600 hover:bg-indigo-50'
                      : 'bg-[#1A1A1A] text-white hover:bg-[#333]'
                    }`}
                >
                  {plan.name === 'Enterprise' ? 'Contact sales' : 'Get started'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 border-t border-[#E5E5E5]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            Ready to add AI search?
          </h2>
          <p className="text-[#666] mb-8 max-w-lg mx-auto">
            Join thousands of developers building intelligent search experiences with Searchy.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              to="/dashboard/login?mode=register"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl font-medium hover:opacity-90 transition-opacity duration-200 flex items-center space-x-2"
            >
              <span>Start building for free</span>
              <ArrowUp className="w-4 h-4 rotate-45" />
            </Link>
            <a 
              href="https://docs.searchy.ai"
              target="_blank"
              rel="noopener noreferrer" 
              className="text-[#666] hover:text-[#1A1A1A] px-8 py-4 font-medium transition-colors duration-200"
            >
              View documentation
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="py-12 px-6 border-t border-[#E5E5E5] bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div>
              <Link to="/" className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Search className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold tracking-tight">Searchy</span>
              </Link>
              <p className="text-sm text-[#999]">
                AI-powered search infrastructure for modern SaaS applications.
              </p>
            </div>

            {/* Links */}
            {[
              { title: 'Product', links: [
                { name: 'Features', href: '#features' },
                { name: 'Pricing', href: '#pricing' },
                { name: 'Docs', href: 'https://docs.searchy.ai' },
                { name: 'API Reference', href: 'https://docs.searchy.ai/api' },
              ]},
              { title: 'Company', links: [
                { name: 'About', href: '#' },
                { name: 'Blog', href: '#' },
                { name: 'Careers', href: '#' },
                { name: 'Contact', href: 'mailto:hello@searchy.ai' },
              ]},
              { title: 'Legal', links: [
                { name: 'Privacy', href: '#' },
                { name: 'Terms', href: '#' },
                { name: 'Security', href: '#' },
              ]},
            ].map((section, index) => (
              <div key={index}>
                <div className="text-sm font-semibold mb-4">{section.title}</div>
                <ul className="space-y-2">
                  {section.links.map((link, i) => (
                    <li key={i}>
                      <a href={link.href} className="text-sm text-[#666] hover:text-[#1A1A1A] transition-colors duration-200">
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-[#E5E5E5]">
            <p className="text-sm text-[#999]">© 2025 Searchy. All rights reserved.</p>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              {[
                { name: 'Twitter', href: 'https://twitter.com/searchy_ai' },
                { name: 'GitHub', href: 'https://github.com/searchy-ai' },
                { name: 'Discord', href: 'https://discord.gg/searchy' },
              ].map((social) => (
                <a key={social.name} href={social.href} target="_blank" rel="noopener noreferrer" className="text-sm text-[#999] hover:text-[#1A1A1A] transition-colors duration-200">
                  {social.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HeroPage;
