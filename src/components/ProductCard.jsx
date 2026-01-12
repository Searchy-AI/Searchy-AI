import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom';
import { Heart, Star, ShoppingCart } from 'lucide-react';
import { useCart } from './CartContext';

function ProductCard({ product }) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const { addToCart } = useCart();

  function getProductImage(product) {
    if (product.main_image && product.main_image.startsWith('http')) return product.main_image;
    if (product.image_urls) {
      try {
        const arr = JSON.parse(product.image_urls.replace(/''/g, '"'));
        if (Array.isArray(arr) && arr.length && arr[0].startsWith('http')) return arr[0];
      } catch {
        const arr = product.image_urls.split(',').map(s => s.replace(/\[|\]|"/g, '').trim()).filter(Boolean);
        if (arr.length && arr[0].startsWith('http')) return arr[0];
      }
    }
    return 'https://via.placeholder.com/200x200?text=No+Image';
  }

  const handleAddToCart = (e) => {
    e.stopPropagation();
    addToCart(product);
  };

  const handleWishlist = (e) => {
    e.stopPropagation();
    setIsWishlisted(!isWishlisted);
  };

  const rating = parseFloat(product.rating || product.rating_stars) || 0;
  const reviewCount = parseInt(product.review_count) || 0;

  return (
    <div
      key={product.product_id || product.sku || product.product_name}
      className="group bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-black/5 hover:border-[#CCC] hover:-translate-y-1"
      onClick={() => navigate(`/product/${product.product_id || product.sku || product.product_name}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <div className="relative bg-[#FAFAFA] p-4">
        <img
          src={getProductImage(product)}
          alt={product.product_name || 'Product'}
          className="h-48 w-full object-contain transition-transform duration-300 group-hover:scale-105"
        />

        {/* Deal Badge */}
        <span className="absolute top-3 left-3 bg-[#1A1A1A] text-white text-xs font-medium px-3 py-1 rounded-full">
          Deal
        </span>

        {/* Wishlist Button */}
        <button
          onClick={handleWishlist}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${isWishlisted
              ? 'bg-red-50 text-red-500'
              : 'bg-white/80 backdrop-blur-sm text-[#666] hover:bg-white hover:text-red-500'
            } shadow-sm`}
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>

        {/* Quick Add to Cart - appears on hover */}
        <div className={`absolute bottom-3 left-3 right-3 transition-all duration-300 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <button
            onClick={handleAddToCart}
            className="w-full bg-[#1A1A1A] text-white text-sm font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#333] transition-colors duration-200"
          >
            <ShoppingCart className="w-4 h-4" />
            Add to Cart
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-2">
        {/* Brand */}
        <span className="text-xs font-medium text-[#999] uppercase tracking-wide">
          {product.brand || 'Brand'}
        </span>

        {/* Product Name */}
        <h3 className="font-semibold text-[#1A1A1A] text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
          {product.product_name || 'No Title'}
        </h3>

        {/* Rating */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${i < Math.floor(rating) ? 'text-amber-400 fill-amber-400' : 'text-[#E5E5E5]'}`}
              />
            ))}
          </div>
          <span className="text-xs text-[#666]">
            {rating > 0 ? rating.toFixed(1) : 'N/A'}
          </span>
          <span className="text-xs text-[#999]">
            ({reviewCount.toLocaleString()})
          </span>
        </div>

        {/* Price Section */}
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-xl font-bold text-[#1A1A1A]">
            ${product.final_price ? parseFloat(product.final_price).toFixed(2) : 'N/A'}
          </span>
          {product.original_price && parseFloat(product.original_price) > parseFloat(product.final_price) && (
            <span className="text-sm text-[#999] line-through">
              ${parseFloat(product.original_price).toFixed(2)}
            </span>
          )}
        </div>

        {/* Category Tag */}
        <div className="mt-2 pt-3 border-t border-[#F0F0F0]">
          <span className="inline-flex items-center text-xs text-[#666] bg-[#FAFAFA] px-2.5 py-1 rounded-full">
            {product.category_name || 'Category'}
          </span>
        </div>
      </div>
    </div>
  )
}

export default ProductCard

