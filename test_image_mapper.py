import pytest
import json
import os
from image_mapper import ImageMapper

@pytest.fixture
def mock_metadata_file(tmp_path):
    metadata = [
        {"image_id": "id1", "filename": "file1.png"},
        {"image_id": "id2", "filename": "file2.jpg"}
    ]
    p = tmp_path / "metadata.json"
    p.write_text(json.dumps(metadata))
    return str(p)

def test_image_mapper_init(mock_metadata_file):
    mapper = ImageMapper(mock_metadata_file)
    assert mapper is not None

def test_get_id_found(mock_metadata_file):
    mapper = ImageMapper(mock_metadata_file)
    assert mapper.get_id("file1.png") == "id1"
    assert mapper.get_id("file2.jpg") == "id2"

def test_get_id_not_found(mock_metadata_file):
    mapper = ImageMapper(mock_metadata_file)
    assert mapper.get_id("nonexistent.png") is None

def test_get_id_empty_filename(mock_metadata_file):
    mapper = ImageMapper(mock_metadata_file)
    assert mapper.get_id("") is None

def test_get_id_none_filename(mock_metadata_file):
    mapper = ImageMapper(mock_metadata_file)
    assert mapper.get_id(None) is None
