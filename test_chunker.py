import pytest
import os
import json
from chunker import chunk_markdown

class MockImageMapper:
    def __init__(self, mapping):
        self.mapping = mapping
    
    def get_id(self, filename):
        return self.mapping.get(filename)

def test_chunk_markdown_basic():
    content = "# Chapter 1\n## Section 1.1\nSome text here."
    book_name = "Pathoma"
    chunks = chunk_markdown(content, book_name)
    
    assert len(chunks) == 1
    chunk = chunks[0]
    assert "Pathoma > Chapter 1 > Section 1.1" in chunk["text"]
    assert "Some text here." in chunk["text"]
    assert chunk["metadata"]["book"] == book_name
    assert chunk["metadata"]["chapter"] == "Chapter 1"
    assert chunk["metadata"]["section"] == "Section 1.1"
    assert chunk["metadata"]["subsection"] == None

def test_chunk_markdown_hierarchy_persistence():
    content = """# Chapter 1
## Section 1.1
### Subsection 1.1.1
Text 1.
## Section 1.2
Text 2.
# Chapter 2
SECTION III
Text 3.
"""
    chunks = chunk_markdown(content, "Book")
    
    assert len(chunks) == 3
    assert "Book > Chapter 1 > Section 1.1 > Subsection 1.1.1" in chunks[0]["text"]
    assert "Text 1." in chunks[0]["text"]
    
    assert "Book > Chapter 1 > Section 1.2" in chunks[1]["text"]
    assert "Text 2." in chunks[1]["text"]
    
    assert "Book > Chapter 2 > III" in chunks[2]["text"]
    assert "Text 3." in chunks[2]["text"]

def test_chunk_markdown_with_images():
    mapper = MockImageMapper({"img1.png": "hash123", "img2.png": "hash456"})
    content = """# Chapter 1
![alt](img1.png)
Some text.
![another](img2.png)
"""
    chunks = chunk_markdown(content, "Book", image_mapper=mapper)
    
    assert len(chunks) == 1
    assert chunks[0]["metadata"]["image_ids"] == ["hash123", "hash456"]

def test_chunk_markdown_max_tokens_splitting():
    # Using a small max_tokens to force splitting if necessary
    # Since we haven't implemented token counting yet, we might use word count or line count as proxy for now
    # or just ensure it handles large blocks.
    content = "# Chapter 1\n" + "word " * 1000
    chunks = chunk_markdown(content, "Book", max_tokens=100)
    
    assert len(chunks) > 1
    for chunk in chunks:
        assert "Book > Chapter 1" in chunk["text"]

def test_chunk_markdown_handles_no_headers():
    content = "Just some text without headers."
    chunks = chunk_markdown(content, "Book")
    
    assert len(chunks) == 1
    assert "Book" in chunks[0]["text"]
    assert "Just some text without headers." in chunks[0]["text"]

def test_chunk_markdown_skips_empty_lines():
    content = "# Ch1\n\n\nText."
    chunks = chunk_markdown(content, "Book")
    assert len(chunks) == 1
    assert chunks[0]["text"].count("Text.") == 1
