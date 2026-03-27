import os
from dotenv import load_dotenv
from pinecone import Pinecone

# Load environment variables from .env
load_dotenv(".env.local")

def get_pinecone_index():
    api_key = os.getenv("PINECONE_API_KEY")
    index_name = os.getenv("PINECONE_INDEX_NAME")
    
    if not api_key or not index_name:
        raise ValueError("Missing PINECONE_API_KEY or PINECONE_INDEX_NAME in .env")
        
    pc = Pinecone(api_key=api_key)
    return pc.Index(index_name)

if __name__ == "__main__":
    try:
        index = get_pinecone_index()
        print(f"Successfully connected to index: {os.getenv('PINECONE_INDEX_NAME')}")
    except Exception as e:
        print(f"Error connecting to Pinecone: {e}")
