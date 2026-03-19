import os
from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv()

api_key = os.getenv("PINECONE_API_KEY")
pc = Pinecone(api_key=api_key)

try:
    indices = pc.list_indexes()
    print("Available indices:")
    for idx in indices:
        print(f"- {idx['name']}")
except Exception as e:
    print(f"Error listing indices: {e}")
