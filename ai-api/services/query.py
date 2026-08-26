import os
import time
from pinecone import Pinecone
from typing import List

class PineClient:
    def __init__(self, api_key:str, INDEX_NAME):
        self.client = Pinecone(api_key=api_key)
        self.INDEX_NAME = INDEX_NAME
        self.index = self.client.Index(self.INDEX_NAME)

    def query(self, embedding:List[float], db="text") -> List:
        t0 = time.perf_counter()
        results=self.index.query(
            vector=embedding,
            top_k=20,
            include_values=True,
            include_metadata=True
        )
        t1 = time.perf_counter()
        if db=="text":
            product_id = [(match["id"], match["score"]) for match in results["matches"]]
        elif db=="image":
            product_id = [(str(int(match["metadata"]["sku"])), match["score"]) for match in results["matches"]]
        t2 = time.perf_counter()
        print(f"[PINECONE] index={self.INDEX_NAME} db={db} | query: {(t1-t0)*1000:.1f}ms | parse: {(t2-t1)*1000:.1f}ms | matches: {len(product_id)}")
        return product_id
