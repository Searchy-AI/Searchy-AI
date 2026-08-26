"""
Metadata Extractor Service

This is the core logic that:
1. Extracts relevant fields from incoming records based on schema
2. Builds text content for embedding from searchable fields
3. Validates records against schema
4. Prepares data for Pinecone upsert (vectors + metadata)
"""
from typing import Dict, Any, List, Optional, Tuple
from database.models import SearchIndex, SchemaField, FieldType
from datetime import datetime
import re


class SchemaValidationError(Exception):
    """Raised when record data doesn't match schema."""
    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"Field '{field}': {message}")


class MetadataExtractor:
    """
    Extracts and validates metadata based on index schema.
    
    This is the JSON Config Processor from your architecture diagram.
    """
    
    def __init__(self, index: SearchIndex):
        self.index = index
        self.schema_fields = {f.name: f for f in index.schema_fields}
        
        # Categorize fields by usage
        self.searchable_fields = [f for f in index.schema_fields if f.is_searchable]
        self.filterable_fields = [f for f in index.schema_fields if f.is_filterable]
        self.displayable_fields = [f for f in index.schema_fields if f.is_displayable]
        self.required_fields = [f for f in index.schema_fields if f.is_required]
        
        # Separate text and image searchable fields
        self.text_searchable = [f for f in self.searchable_fields if f.field_type != FieldType.IMAGE]
        self.image_searchable = [f for f in self.searchable_fields if f.field_type == FieldType.IMAGE]
    
    def validate_record(self, data: Dict[str, Any]) -> List[SchemaValidationError]:
        """
        Validate a record against the schema.
        Returns list of validation errors (empty if valid).
        """
        errors = []
        
        # Check required fields
        for field in self.required_fields:
            if field.name not in data or data[field.name] is None:
                errors.append(SchemaValidationError(
                    field.name,
                    "This field is required."
                ))
        
        # Validate field types and constraints
        for field_name, value in data.items():
            if field_name not in self.schema_fields:
                continue  # Ignore extra fields
            
            field = self.schema_fields[field_name]
            
            if value is None:
                continue  # Already checked required
            
            # Type validation
            error = self._validate_field_type(field, value)
            if error:
                errors.append(error)
        
        return errors
    
    def _validate_field_type(self, field: SchemaField, value: Any) -> Optional[SchemaValidationError]:
        """Validate a single field value against its type."""
        
        if field.field_type == FieldType.TEXT:
            if not isinstance(value, str):
                return SchemaValidationError(field.name, f"Expected string, got {type(value).__name__}")
        
        elif field.field_type == FieldType.NUMBER:
            if not isinstance(value, (int, float)):
                return SchemaValidationError(field.name, f"Expected number, got {type(value).__name__}")
            if field.min_value is not None and value < field.min_value:
                return SchemaValidationError(field.name, f"Value {value} is below minimum {field.min_value}")
            if field.max_value is not None and value > field.max_value:
                return SchemaValidationError(field.name, f"Value {value} is above maximum {field.max_value}")
        
        elif field.field_type == FieldType.ENUM:
            if value not in (field.enum_values or []):
                return SchemaValidationError(
                    field.name, 
                    f"Value '{value}' not in allowed values: {field.enum_values}"
                )
        
        elif field.field_type == FieldType.BOOLEAN:
            if not isinstance(value, bool):
                return SchemaValidationError(field.name, f"Expected boolean, got {type(value).__name__}")
        
        elif field.field_type == FieldType.DATE:
            if isinstance(value, str):
                try:
                    datetime.fromisoformat(value.replace('Z', '+00:00'))
                except ValueError:
                    return SchemaValidationError(field.name, "Invalid date format. Use ISO 8601.")
        
        elif field.field_type == FieldType.IMAGE:
            if not isinstance(value, str):
                return SchemaValidationError(field.name, "Expected image URL or base64 string")
            # Basic URL validation
            if not (value.startswith('http://') or value.startswith('https://') or value.startswith('data:')):
                return SchemaValidationError(field.name, "Image must be a URL or base64 data URI")
        
        elif field.field_type == FieldType.URL:
            if not isinstance(value, str):
                return SchemaValidationError(field.name, "Expected URL string")
            if not (value.startswith('http://') or value.startswith('https://')):
                return SchemaValidationError(field.name, "Invalid URL format")
        
        elif field.field_type == FieldType.GEO:
            if not isinstance(value, dict) or 'lat' not in value or 'lng' not in value:
                return SchemaValidationError(field.name, "Expected {lat, lng} object")
            if not (-90 <= value['lat'] <= 90):
                return SchemaValidationError(field.name, "Latitude must be between -90 and 90")
            if not (-180 <= value['lng'] <= 180):
                return SchemaValidationError(field.name, "Longitude must be between -180 and 180")
        
        return None
    
    def extract_embedding_text(self, data: Dict[str, Any]) -> str:
        """
        Extract text content for embedding from searchable fields.
        
        Combines multiple text fields with weights for embedding.
        """
        text_parts = []
        
        for field in self.text_searchable:
            value = data.get(field.name)
            if not value:
                continue
            
            # For text fields, add directly
            if field.field_type == FieldType.TEXT:
                # Repeat based on weight for emphasis
                weight = int(field.embedding_weight)
                text_parts.extend([str(value)] * max(1, weight))
            
            # For enum fields, add the value
            elif field.field_type == FieldType.ENUM:
                text_parts.append(str(value))
            
            # For other types, convert to string
            else:
                text_parts.append(str(value))
        
        # Join with spaces and clean up
        text = " ".join(text_parts)
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def extract_image_urls(self, data: Dict[str, Any]) -> List[str]:
        """
        Extract image URLs/data for visual embedding.
        """
        images = []
        
        for field in self.image_searchable:
            value = data.get(field.name)
            if value:
                images.append(value)
        
        return images
    
    def extract_filter_metadata(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract filterable fields for Pinecone metadata.
        
        Pinecone metadata is used for filtering during search.
        """
        metadata = {}
        
        for field in self.filterable_fields:
            value = data.get(field.name)
            if value is None:
                continue
            
            # Handle different types for Pinecone metadata
            if field.field_type == FieldType.GEO:
                # Pinecone doesn't support geo directly, store as separate fields
                if isinstance(value, dict):
                    metadata[f"{field.name}_lat"] = value.get('lat')
                    metadata[f"{field.name}_lng"] = value.get('lng')
            elif field.field_type == FieldType.DATE:
                # Store as Unix timestamp for range queries
                if isinstance(value, str):
                    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    metadata[field.name] = int(dt.timestamp())
                elif isinstance(value, datetime):
                    metadata[field.name] = int(value.timestamp())
            else:
                metadata[field.name] = value
        
        return metadata
    
    def extract_display_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract displayable fields for search results.
        """
        display = {}
        
        for field in self.displayable_fields:
            if field.name in data:
                display[field.name] = data[field.name]
        
        return display
    
    def process_record(self, record_id: str, data: Dict[str, Any]) -> Tuple[str, Dict[str, Any], List[str]]:
        """
        Process a record for ingestion.
        
        Returns:
            - embedding_text: Text to embed
            - pinecone_metadata: Metadata for Pinecone (filters + display)
            - image_urls: Images to embed (if any)
        """
        # Validate
        errors = self.validate_record(data)
        if errors:
            raise errors[0]  # Raise first error
        
        # Extract components
        embedding_text = self.extract_embedding_text(data)
        image_urls = self.extract_image_urls(data)
        filter_metadata = self.extract_filter_metadata(data)
        display_data = self.extract_display_data(data)
        
        # Combine metadata (filters take precedence)
        pinecone_metadata = {
            **display_data,
            **filter_metadata,
            "_record_id": record_id,  # For reverse lookup
            "_indexed_at": datetime.utcnow().isoformat()
        }
        
        return embedding_text, pinecone_metadata, image_urls
    
    def get_schema_summary(self) -> Dict[str, Any]:
        """
        Get a summary of the schema for documentation/debugging.
        """
        return {
            "index_name": self.index.name,
            "namespace": self.index.namespace,
            "total_fields": len(self.schema_fields),
            "searchable_fields": [f.name for f in self.searchable_fields],
            "filterable_fields": [f.name for f in self.filterable_fields],
            "required_fields": [f.name for f in self.required_fields],
            "text_embedding_fields": [f.name for f in self.text_searchable],
            "image_embedding_fields": [f.name for f in self.image_searchable]
        }
