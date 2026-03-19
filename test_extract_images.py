from unittest.mock import MagicMock, patch
import os
import json
from extract_images import extract_images

@patch("extract_images.fitz.open")
def test_extract_images_basic(mock_open, tmp_path):
    # Mock Document and Page
    mock_doc = MagicMock()
    mock_page = MagicMock()
    mock_open.return_value = mock_doc
    mock_doc.__len__.return_value = 1
    mock_doc.__getitem__.return_value = mock_page
    mock_doc.get_toc.return_value = [[1, "Chapter 1", 1]]
    
    # Mock Image Info
    mock_page.get_image_info.return_value = [{"xref": 10, "bbox": (0,0,100,100)}]
    mock_page.get_text.return_value = [] # No captions
    
    # Mock Extract Image
    mock_doc.extract_image.return_value = {
        "image": b"fake-png-data",
        "width": 100,
        "height": 100
    }
    
    output_dir = tmp_path / "extracted"
    new_entries = extract_images("fake.pdf", output_root=str(output_dir))
    
    assert len(new_entries) == 1
    assert os.path.exists(output_dir / "metadata.json")
    assert os.path.exists(output_dir / "images" / f"{new_entries[0]['image_id']}.png")
