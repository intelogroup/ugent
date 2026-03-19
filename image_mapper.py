import json
import os

class ImageMapper:
    """Resolves image filenames to their corresponding image_ids from a metadata file."""

    def __init__(self, metadata_path):
        """
        Initialize the ImageMapper with the path to the metadata.json file.

        Args:
            metadata_path (str): The absolute path to the metadata.json file.
        """
        self.mapping = {}
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                    for entry in metadata:
                        if 'filename' in entry and 'image_id' in entry:
                            self.mapping[entry['filename']] = entry['image_id']
            except (json.JSONDecodeError, IOError) as e:
                # In a real scenario, we might want to log this error.
                pass

    def get_id(self, filename):
        """
        Retrieve the image_id for a given filename.

        Args:
            filename (str): The filename of the image.

        Returns:
            str: The corresponding image_id, or None if not found or filename is invalid.
        """
        if not filename:
            return None
        return self.mapping.get(filename)
