import re

class ImageMapper:
    """Interface for mapping image filenames to IDs/hashes."""
    def get_id(self, filename):
        raise NotImplementedError

def chunk_markdown(content, book_name, image_mapper=None, max_tokens=512):
    """
    Chunks markdown while preserving hierarchical context.
    Prepend breadcrumb: Book > Chapter > Section
    Extracts image IDs using image_mapper.
    """
    # approx 4 characters per token
    max_chars = max_tokens * 4
    
    lines = content.split('\n')
    chunks = []
    
    current_chapter = None
    current_section = None
    current_subsection = None
    
    current_chunk_lines = []
    current_chunk_image_ids = set()
    
    def get_breadcrumb():
        parts = [book_name]
        if current_chapter:
            parts.append(current_chapter)
        if current_section:
            parts.append(current_section)
        if current_subsection:
            parts.append(current_subsection)
        return " > ".join(parts)

    def finalize_chunk():
        if not current_chunk_lines:
            return
        
        breadcrumb = get_breadcrumb()
        text = breadcrumb + "\n\n" + "\n".join(current_chunk_lines)
        
        chunks.append({
            "text": text,
            "metadata": {
                "book": book_name,
                "chapter": current_chapter,
                "section": current_section,
                "subsection": current_subsection,
                "image_ids": sorted(list(current_chunk_image_ids))
            }
        })
        current_chunk_lines.clear()
        current_chunk_image_ids.clear()

    for line in lines:
        if not line.strip():
            continue
            
        # Header detection
        chapter_match = re.match(r'^#\s+(.*)', line)
        section_match = re.match(r'^##\s+(.*)', line)
        subsection_match = re.match(r'^###\s+(.*)', line)
        # SECTION markers from plan
        section_marker_match = re.match(r'^SECTION\s+(.*)', line)
        
        if chapter_match:
            finalize_chunk()
            current_chapter = chapter_match.group(1).strip()
            current_section = None
            current_subsection = None
            continue
            
        if section_match or section_marker_match:
            finalize_chunk()
            current_section = (section_match or section_marker_match).group(1).strip()
            current_subsection = None
            continue

        if subsection_match:
            finalize_chunk()
            current_subsection = subsection_match.group(1).strip()
            continue
            
        # Image detection
        image_matches = re.findall(r'!\[.*?\]\((.*?)\)', line)
        if image_matches and image_mapper:
            for img_path in image_matches:
                # Resolve filename from path if necessary
                filename = img_path.split('/')[-1]
                img_id = image_mapper.get_id(filename)
                if img_id:
                    current_chunk_image_ids.add(img_id)
        
        # Simple size-based splitting within a section
        # Split the line if it's too long itself
        while len(line) > max_chars:
            # Try to split at word boundary
            split_idx = line.rfind(' ', 0, max_chars)
            if split_idx == -1:
                split_idx = max_chars
                
            part = line[:split_idx]
            line = line[split_idx:].lstrip()
            
            # If we already have content in current chunk, and adding this part exceeds max_chars, finalize it.
            if current_chunk_lines and len("\n".join(current_chunk_lines + [part])) > max_chars:
                finalize_chunk()
            
            current_chunk_lines.append(part)
            finalize_chunk() # Each part is a full chunk because it's approximately max_chars

        # For the remaining part of the line (or if it wasn't too long)
        if line:
            estimated_total_chars = len("\n".join(current_chunk_lines + [line]))
            if estimated_total_chars > max_chars:
                finalize_chunk()
                
            current_chunk_lines.append(line)
        
    finalize_chunk()
    return chunks
