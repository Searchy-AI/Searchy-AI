import cohere
import os
import time
from typing import List

class Cohere:
    def __init__(self, api_key:str, EMBED_MODEL:str="embed-v4.0"):
        self.client = cohere.Client(api_key=api_key)
        self.EMBED_MODEL = EMBED_MODEL

    def get_text_embeddings(self, query:str) -> List:
        t0 = time.perf_counter()
        response = self.client.embed(
            texts=[query],
            model=self.EMBED_MODEL,
            input_type="search_document",
            embedding_types=["float"]
        )
        t1 = time.perf_counter()
        print(f"[COHERE] text_embedding: {(t1-t0)*1000:.1f}ms | query_length: {len(query)} chars")
        return response.embeddings.float[0]

    def get_image_embeddings(self, image_url:str) -> List:
        t0 = time.perf_counter()
        response = self.client.embed(
            images=[image_url],
            model=self.EMBED_MODEL,
            input_type="image",
            embedding_types=["float"]
        )
        t1 = time.perf_counter()
        size_kb = len(image_url) / 1024 if image_url.startswith("data:") else "URL"
        print(f"[COHERE] image_embedding: {(t1-t0)*1000:.1f}ms | image_size: {size_kb}kb")
        return response.embeddings.float[0]