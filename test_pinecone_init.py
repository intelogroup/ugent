import os
from unittest.mock import MagicMock, patch
from pinecone_init import get_pinecone_index

@patch("pinecone_init.Pinecone")
def test_get_pinecone_index_success(mock_pinecone, monkeypatch):
    monkeypatch.setenv("PINECONE_API_KEY", "test-key")
    monkeypatch.setenv("PINECONE_INDEX_NAME", "test-index")
    
    mock_instance = MagicMock()
    mock_pinecone.return_value = mock_instance
    
    index = get_pinecone_index()
    
    mock_pinecone.assert_called_once_with(api_key="test-key")
    mock_instance.Index.assert_called_once_with("test-index")
