import cohere
import os
from typing import List

class Cohere:
    def __init__(self, api_key:str, EMBED_MODEL:str="embed-v4.0"):
        self.client = cohere.Client(api_key=api_key)
        self.EMBED_MODEL = EMBED_MODEL
    
    def get_text_embeddings(self, query:str) -> List:
        response = self.client.embed(
            texts=[query],
            model=self.EMBED_MODEL,
            input_type="search_document",  # use "search_query" when embedding queries
            embedding_types=["float"]  # specify embedding type
        )
        return response.embeddings.float[0]
    
    def get_image_embeddings(self, image_url:str) -> List:
        response = self.client.embed(
            images=[image_url],
            model=self.EMBED_MODEL,
            input_type="image",
            embedding_types=["float"]  # specify embedding type
        )
        return response.embeddings.float[0]