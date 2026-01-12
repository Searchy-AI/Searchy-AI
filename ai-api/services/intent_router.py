"""
Intent Router Service - LLM-based query classification

Classifies user queries into different intent types:
- semantic_search: Natural language search queries
- keyword_search: Exact match queries  
- filter_query: Structured filter-based queries
- image_search: Image similarity search
- hybrid: Combination of semantic + filters
"""
import os
import json
import re
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from enum import Enum
import cohere


class QueryIntent(str, Enum):
    SEMANTIC_SEARCH = "semantic_search"
    KEYWORD_SEARCH = "keyword_search"
    FILTER_QUERY = "filter_query"
    IMAGE_SEARCH = "image_search"
    HYBRID = "hybrid"


class ParsedFilter(BaseModel):
    field: str
    operator: str  # eq, ne, gt, gte, lt, lte, in, contains
    value: Any


class IntentResult(BaseModel):
    intent: QueryIntent
    confidence: float
    semantic_query: Optional[str] = None
    filters: Optional[List[ParsedFilter]] = None
    keywords: Optional[List[str]] = None
    reasoning: Optional[str] = None


class IntentRouter:
    """
    Routes queries to the appropriate search strategy using LLM.
    
    Uses Cohere's chat model to:
    1. Classify query intent
    2. Extract structured filters from natural language
    3. Separate semantic vs keyword components
    """
    
    def __init__(self):
        self.client = cohere.Client(api_key=os.getenv("COHERE_API_KEY"))
        self.model = "command-r-plus"
    
    def _get_classification_prompt(self, query: str, schema_fields: List[Dict]) -> str:
        """Generate the prompt for intent classification."""
        field_descriptions = "\n".join([
            f"- {f['name']} ({f['field_type']}): {f.get('description', 'No description')}"
            + (f" [filterable]" if f.get('is_filterable') else "")
            + (f" [searchable]" if f.get('is_searchable') else "")
            for f in schema_fields
        ])
        
        return f"""You are a query intent classifier for a search system. Analyze the user query and determine the best search strategy.

Available fields in the schema:
{field_descriptions}

User Query: "{query}"

Classify the query into one of these intents:
1. semantic_search - Natural language queries seeking conceptually similar items (e.g., "comfortable running shoes", "movies like inception")
2. keyword_search - Exact text matches, brand names, product codes (e.g., "Nike Air Max", "SKU12345")  
3. filter_query - Structured attribute queries (e.g., "price under $50", "size medium", "color blue")
4. image_search - Queries about visual similarity (e.g., "similar looking products", "items that look like this")
5. hybrid - Combination of semantic search with filters (e.g., "comfortable running shoes under $100")

Also extract any filters from the query. Map natural language to structured filters:
- "under $X", "less than X", "below X" → operator: "lte", field: relevant_price_field
- "over $X", "more than X", "above X" → operator: "gte", field: relevant_price_field
- "between X and Y" → two filters with gte and lte
- "color red", "in red" → operator: "eq", field: color, value: "red"
- Category mentions → operator: "eq", field: category

Respond in JSON format:
{{
    "intent": "semantic_search|keyword_search|filter_query|image_search|hybrid",
    "confidence": 0.0-1.0,
    "semantic_query": "the semantic/conceptual part of the query (null if not applicable)",
    "filters": [
        {{"field": "field_name", "operator": "eq|ne|gt|gte|lt|lte|in|contains", "value": "value"}}
    ],
    "keywords": ["exact", "match", "keywords"],
    "reasoning": "brief explanation of classification"
}}"""

    def classify_query(
        self,
        query: str,
        schema_fields: List[Dict],
        has_image: bool = False
    ) -> IntentResult:
        """
        Classify a query and extract structured information.
        
        Args:
            query: The user's search query
            schema_fields: List of schema field definitions
            has_image: Whether an image was provided with the query
            
        Returns:
            IntentResult with classified intent and extracted data
        """
        # If image is provided, default to image search
        if has_image and not query.strip():
            return IntentResult(
                intent=QueryIntent.IMAGE_SEARCH,
                confidence=1.0,
                reasoning="Image provided without text query"
            )
        
        # Quick heuristic checks for obvious cases
        quick_result = self._quick_classify(query, schema_fields)
        if quick_result:
            return quick_result
        
        # Use LLM for complex classification
        try:
            prompt = self._get_classification_prompt(query, schema_fields)
            
            response = self.client.chat(
                model=self.model,
                message=prompt,
                temperature=0.1,  # Low temperature for consistent classification
            )
            
            # Parse JSON response
            result_text = response.text
            
            # Extract JSON from response (handle markdown code blocks)
            json_match = re.search(r'```json\s*(.*?)\s*```', result_text, re.DOTALL)
            if json_match:
                result_text = json_match.group(1)
            else:
                # Try to find raw JSON
                json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
                if json_match:
                    result_text = json_match.group(0)
            
            result_data = json.loads(result_text)
            
            # Parse filters
            filters = None
            if result_data.get("filters"):
                filters = [
                    ParsedFilter(
                        field=f["field"],
                        operator=f["operator"],
                        value=f["value"]
                    ) for f in result_data["filters"]
                ]
            
            return IntentResult(
                intent=QueryIntent(result_data["intent"]),
                confidence=result_data.get("confidence", 0.8),
                semantic_query=result_data.get("semantic_query"),
                filters=filters,
                keywords=result_data.get("keywords"),
                reasoning=result_data.get("reasoning")
            )
            
        except Exception as e:
            # Fallback to semantic search if LLM fails
            return IntentResult(
                intent=QueryIntent.SEMANTIC_SEARCH,
                confidence=0.5,
                semantic_query=query,
                reasoning=f"LLM classification failed: {str(e)}, defaulting to semantic search"
            )
    
    def _quick_classify(
        self,
        query: str,
        schema_fields: List[Dict]
    ) -> Optional[IntentResult]:
        """
        Quick heuristic-based classification for obvious cases.
        Returns None if LLM classification is needed.
        """
        query_lower = query.lower().strip()
        
        # Check for obvious filter patterns
        filter_patterns = [
            r'(?:price|cost)\s*(?:under|below|less than|<)\s*\$?\d+',
            r'(?:price|cost)\s*(?:over|above|more than|>)\s*\$?\d+',
            r'(?:under|below|less than)\s*\$\d+',
            r'(?:over|above|more than)\s*\$\d+',
            r'\$\d+\s*(?:or less|and under)',
        ]
        
        has_filter = any(re.search(p, query_lower) for p in filter_patterns)
        
        # Check for product codes/SKUs (alphanumeric patterns)
        has_sku_pattern = re.search(r'\b[A-Z]{2,}\d{3,}|\b\d{5,}\b', query)
        
        # Check for quoted exact matches
        has_quoted = '"' in query or "'" in query
        
        # Very short queries (1-2 words) are likely keywords
        word_count = len(query.split())
        
        if has_sku_pattern or has_quoted:
            return IntentResult(
                intent=QueryIntent.KEYWORD_SEARCH,
                confidence=0.9,
                keywords=query.split(),
                reasoning="Query contains SKU pattern or quoted text"
            )
        
        if has_filter and word_count <= 5:
            # Extract simple price filter
            filters = self._extract_simple_filters(query, schema_fields)
            return IntentResult(
                intent=QueryIntent.FILTER_QUERY,
                confidence=0.85,
                filters=filters,
                reasoning="Query is primarily a filter expression"
            )
        
        if has_filter:
            # Has both semantic and filter components
            return None  # Let LLM handle hybrid classification
        
        if word_count <= 2 and not any(c in query_lower for c in ['like', 'similar', 'for', 'best']):
            return IntentResult(
                intent=QueryIntent.KEYWORD_SEARCH,
                confidence=0.7,
                keywords=query.split(),
                reasoning="Short query likely seeking exact match"
            )
        
        return None  # Needs LLM classification
    
    def _extract_simple_filters(
        self,
        query: str,
        schema_fields: List[Dict]
    ) -> List[ParsedFilter]:
        """Extract simple price/numeric filters from query."""
        filters = []
        query_lower = query.lower()
        
        # Find price field
        price_field = next(
            (f['name'] for f in schema_fields 
             if 'price' in f['name'].lower() and f.get('is_filterable')),
            'price'
        )
        
        # Under/below patterns
        match = re.search(r'(?:under|below|less than|<)\s*\$?(\d+(?:\.\d{2})?)', query_lower)
        if match:
            filters.append(ParsedFilter(
                field=price_field,
                operator="lte",
                value=float(match.group(1))
            ))
        
        # Over/above patterns
        match = re.search(r'(?:over|above|more than|>)\s*\$?(\d+(?:\.\d{2})?)', query_lower)
        if match:
            filters.append(ParsedFilter(
                field=price_field,
                operator="gte",
                value=float(match.group(1))
            ))
        
        return filters


# Global instance
_intent_router: Optional[IntentRouter] = None


def get_intent_router() -> IntentRouter:
    """Get or create the global intent router instance."""
    global _intent_router
    if _intent_router is None:
        _intent_router = IntentRouter()
    return _intent_router


def classify_query(
    query: str,
    schema_fields: List[Dict],
    has_image: bool = False
) -> IntentResult:
    """
    Convenience function to classify a query.
    
    Usage:
        from services.intent_router import classify_query
        
        result = classify_query(
            "comfortable running shoes under $100",
            schema_fields=[
                {"name": "title", "field_type": "text", "is_searchable": True},
                {"name": "price", "field_type": "number", "is_filterable": True},
            ]
        )
        
        print(result.intent)  # QueryIntent.HYBRID
        print(result.semantic_query)  # "comfortable running shoes"
        print(result.filters)  # [ParsedFilter(field="price", operator="lte", value=100)]
    """
    router = get_intent_router()
    return router.classify_query(query, schema_fields, has_image)
