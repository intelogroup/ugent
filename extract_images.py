import fitz
import os
import hashlib
import json
from datetime import datetime
from chapter_resolver import get_chapter_from_toc

def find_caption(page, img_rect, threshold=50):
    blocks = page.get_text("blocks")
    closest_text = ""
    min_dist = float('inf')
    
    for b in blocks:
        # b = (x0, y0, x1, y1, "text", block_no, block_type)
        if b[6] == 0: # text block
            block_rect = fitz.Rect(b[:4])
            dist_below = abs(block_rect.y0 - img_rect.y1)
            dist_above = abs(block_rect.y1 - img_rect.y0)
            
            curr_min = min(dist_below, dist_above)
            if curr_min < min_dist and curr_min < threshold:
                min_dist = curr_min
                closest_text = b[4].strip()
                
    return closest_text

def extract_images(pdf_path, output_root="extracted_images"):
    doc = fitz.open(pdf_path)
    toc = doc.get_toc()
    img_dir = os.path.join(output_root, "images")
    metadata_path = os.path.join(output_root, "metadata.json")
    os.makedirs(img_dir, exist_ok=True)
    
    # Load existing metadata to prevent duplicates
    if os.path.exists(metadata_path):
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
    else:
        metadata = []
    
    existing_ids = {m["image_id"] for m in metadata}
    new_entries = []
    
    for page_index in range(len(doc)):
        page = doc[page_index]
        page_num = page_index + 1
        chapter = get_chapter_from_toc(page_num, toc)
        
        # In PyMuPDF 1.25.0+, get_image_info() is the modern way to get image metadata
        # for page_index in range(len(doc)):
        #     page = doc[page_index]
        #     for img in page.get_image_info():
        #         xref = img["xref"]
        #         if xref == 0: continue
        #         img_rect = fitz.Rect(img["bbox"])
        
        for img_info in page.get_image_info(xrefs=True):
            xref = img_info["xref"]
            if xref == 0: continue
            
            img_rect = fitz.Rect(img_info["bbox"])
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            
            if base_image["width"] < 50 or base_image["height"] < 50:
                continue
                
            img_hash = hashlib.md5(image_bytes).hexdigest()
            filename = f"{img_hash}.png"
            filepath = os.path.join(img_dir, filename)
            
            if not os.path.exists(filepath):
                with open(filepath, "wb") as f:
                    f.write(image_bytes)
            
            if img_hash not in existing_ids:
                caption = find_caption(page, img_rect)
                entry = {
                    "image_id": img_hash,
                    "filename": filename,
                    "source_book": os.path.basename(pdf_path),
                    "chapter": chapter,
                    "page_number": page_num,
                    "caption_candidate": caption,
                    "timestamp": datetime.now().isoformat()
                }
                metadata.append(entry)
                new_entries.append(entry)
                existing_ids.add(img_hash)
    
    # Atomic write
    temp_path = metadata_path + ".tmp"
    with open(temp_path, "w") as f:
        json.dump(metadata, f, indent=2)
    os.replace(temp_path, metadata_path)
    
    doc.close() # Ensure doc is closed
    return new_entries

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        new = extract_images(sys.argv[1])
        print(f"Extracted {len(new)} new images from {sys.argv[1]}")
