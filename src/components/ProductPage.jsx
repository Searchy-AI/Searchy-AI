import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart, Star, ShoppingCart, Truck, MapPin, Clock, ChevronLeft } from 'lucide-react';
import { useCart } from './CartContext';
import Papa from 'papaparse';

const BACKEND_URL = 'http://localhost:4000';

function parseImages(product) {
  if (product.main_image && product.main_image.startsWith('http')) return [product.main_image];
  if (product.image_urls) {
    try {
      const arr = JSON.parse(product.image_urls.replace(/''/g, '"'));
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {
      const arr = product.image_urls.split(',').map(s => s.replace(/\[|\]|"/g, '').trim()).filter(Boolean);
      if (arr.length) return arr;
    }
  }
  return ['https://via.placeholder.com/200x200?text=No+Image'];
}

const ProductPage = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [mainImage, setMainImage] = useState('');
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [added, setAdded] = useState(false);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND_URL}/product/${encodeURIComponent(id)}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(found => {
        setProduct(found);
        setMainImage(parseImages(found)[0]);
        setLoading(false);
      })
      .catch(() => {
        setProduct(null);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    // Only fetch reviews if product is loaded
    if (!product) return;
    fetch('/walmart-products.csv')
      .then(res => res.text())
      .then(csv => {
        Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            // Find the row for this product
            const row = results.data.find(row => row.product_id === String(product.product_id));
            let parsedReviews = [];
            if (row && row.customer_reviews) {
              try {
                parsedReviews = JSON.parse(row.customer_reviews);
              } catch { }
            }
            if ((!parsedReviews || parsedReviews.length === 0) && row && row.top_reviews) {
              try {
                parsedReviews = JSON.parse(row.top_reviews);
              } catch { }
            }
            setReviews(parsedReviews || []);
          }
        });
      });
  }, [product]);

  const price = product?.final_price ? parseFloat(product.final_price).toFixed(2) : 'N/A';
  const rating = parseFloat(product?.rating || product?.rating_stars) || 0;
  const reviewCount = parseInt(product?.review_count) || 0;

  if (loading) return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#1A1A1A] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[#666]">Loading product...</p>
      </div>
    </div>
  );
  if (!product) return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
      <div className="text-center">
        <p className="text-xl text-[#1A1A1A] mb-4">Product not found</p>
        <button onClick={() => navigate('/')} className="text-[#666] hover:text-[#1A1A1A] flex items-center gap-2 mx-auto">
          <ChevronLeft className="w-4 h-4" /> Back to Home
        </button>
      </div>
    </div>
  );

  const images = parseImages(product);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[#666] hover:text-[#1A1A1A] transition-colors text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to results
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Images */}
          <div className="lg:col-span-1 flex lg:flex-col gap-2 order-2 lg:order-1">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setMainImage(img)}
                className={`w-16 h-16 rounded-xl border-2 overflow-hidden transition-all duration-200 ${mainImage === img ? 'border-[#1A1A1A]' : 'border-[#E5E5E5] hover:border-[#CCC]'}`}
              >
                <img src={img} alt={`${product.product_name} ${idx + 1}`} className="w-full h-full object-contain" />
              </button>
            ))}
          </div>

          {/* Center: Main Image */}
          <div className="lg:col-span-5 order-1 lg:order-2">
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-8 sticky top-24">
              <img src={mainImage} alt={product.product_name || 'Product'} className="w-full h-96 object-contain" />
            </div>
          </div>

          {/* Right: Product Info */}
          <div className="lg:col-span-6 order-3 space-y-6">
            {/* Brand & Title */}
            <div>
              <span className="text-xs font-medium text-[#999] uppercase tracking-wide">{product.brand || 'Brand'}</span>
              <h1 className="text-2xl font-semibold text-[#1A1A1A] mt-1 leading-tight">{product.product_name || 'No Title'}</h1>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < Math.floor(rating) ? 'text-amber-400 fill-amber-400' : 'text-[#E5E5E5]'}`} />
                ))}
              </div>
              <span className="text-sm font-medium text-[#1A1A1A]">{rating > 0 ? rating.toFixed(1) : 'N/A'}</span>
              <span className="text-sm text-[#666]">{reviewCount.toLocaleString()} reviews</span>
            </div>

            {/* Price Card */}
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-3xl font-bold text-[#1A1A1A]">${price}</span>
                {product.original_price && parseFloat(product.original_price) > parseFloat(product.final_price) && (
                  <span className="text-lg text-[#999] line-through">${parseFloat(product.original_price).toFixed(2)}</span>
                )}
              </div>
              <p className="text-xs text-[#666] mb-6">Price when purchased online</p>

              {/* Add to Cart Button */}
              <button
                onClick={() => {
                  if (!added) {
                    addToCart({
                      id: product.product_id || product.sku || product.product_name,
                      product_name: product.product_name,
                      final_price: price,
                      ...product
                    });
                    setAdded(true);
                  } else {
                    navigate('/cart');
                  }
                }}
                className={`w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${added
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'bg-[#1A1A1A] text-white hover:bg-[#333]'
                  }`}
              >
                <ShoppingCart className="w-5 h-5" />
                {added ? 'Go to Cart' : 'Add to Cart'}
              </button>

              {/* Wishlist Button */}
              <button className="w-full py-3 mt-3 rounded-xl font-medium border-2 border-[#E5E5E5] text-[#1A1A1A] flex items-center justify-center gap-2 hover:border-[#CCC] transition-colors">
                <Heart className="w-5 h-5" />
                Add to Wishlist
              </button>
            </div>

            {/* Delivery Options */}
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
              <h3 className="font-semibold text-[#1A1A1A] mb-4">Delivery Options</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#FAFAFA]">
                  <Truck className="w-5 h-5 text-[#666] mt-0.5" />
                  <div>
                    <p className="font-medium text-[#1A1A1A] text-sm">Free Shipping</p>
                    <p className="text-xs text-[#666]">Arrives tomorrow</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#FAFAFA]">
                  <MapPin className="w-5 h-5 text-[#666] mt-0.5" />
                  <div>
                    <p className="font-medium text-[#1A1A1A] text-sm">Store Pickup</p>
                    <p className="text-xs text-[#666]">Ready as soon as 5pm today</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#FAFAFA]">
                  <Clock className="w-5 h-5 text-[#666] mt-0.5" />
                  <div>
                    <p className="font-medium text-[#1A1A1A] text-sm">Express Delivery</p>
                    <p className="text-xs text-[#666]">As soon as 1 hour</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Details */}
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
              <h3 className="font-semibold text-[#1A1A1A] mb-4">About this item</h3>
              <p className="text-sm text-[#666] leading-relaxed mb-6">{product.description || 'No description available.'}</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#FAFAFA]">
                  <p className="text-xs text-[#999] mb-1">Brand</p>
                  <p className="font-medium text-[#1A1A1A] text-sm">{product.brand || 'N/A'}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#FAFAFA]">
                  <p className="text-xs text-[#999] mb-1">Category</p>
                  <p className="font-medium text-[#1A1A1A] text-sm">{product.category_name || 'N/A'}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#FAFAFA]">
                  <p className="text-xs text-[#999] mb-1">SKU</p>
                  <p className="font-medium text-[#1A1A1A] text-sm">{product.sku || 'N/A'}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#FAFAFA]">
                  <p className="text-xs text-[#999] mb-1">Stock</p>
                  <p className="font-medium text-[#1A1A1A] text-sm">{product.stock || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Reviews Section */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
          <h2 className="text-xl font-semibold text-[#1A1A1A] mb-6">Customer Reviews</h2>
          {reviews && reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-[#FAFAFA] border-b border-[#E5E5E5] last:border-b-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < (review.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-[#E5E5E5]'}`} />
                      ))}
                    </div>
                    <span className="font-medium text-[#1A1A1A] text-sm">{review.title || ''}</span>
                  </div>
                  <p className="text-sm text-[#666] mb-2">{review.review}</p>
                  <p className="text-xs text-[#999]">{review.name || 'Anonymous'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#666]">No reviews available for this product.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductPage; 