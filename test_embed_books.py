import os
import json
import unittest
from unittest.mock import patch, MagicMock
import embed_books
import builtins
real_open = builtins.open

class TestEmbedBooks(unittest.TestCase):
    def setUp(self):
        # Ensure we use a test checkpoint file
        self.old_checkpoint_file = embed_books.CHECKPOINT_FILE
        embed_books.CHECKPOINT_FILE = "test_checkpoint.json"
        if os.path.exists(embed_books.CHECKPOINT_FILE):
            os.remove(embed_books.CHECKPOINT_FILE)

    def tearDown(self):
        if os.path.exists(embed_books.CHECKPOINT_FILE):
            os.remove(embed_books.CHECKPOINT_FILE)
        embed_books.CHECKPOINT_FILE = self.old_checkpoint_file

    def test_checkpoint_persistence(self):
        """Test that checkpoint is saved and loaded correctly."""
        embed_books.save_checkpoint("Book A", "chapter1.md", 150)
        checkpoint = embed_books.load_checkpoint()
        self.assertEqual(checkpoint["last_book"], "Book A")
        self.assertEqual(checkpoint["last_file"], "chapter1.md")
        self.assertEqual(checkpoint["last_chunk_index"], 150)

    @patch("embed_books.client.embeddings.create")
    def test_get_embeddings_batching(self, mock_create):
        """Test that get_embeddings calls OpenAI correctly."""
        # Mock response
        mock_data = [MagicMock(embedding=[0.1]*3072) for _ in range(5)]
        mock_create.return_value = MagicMock(data=mock_data)
        
        texts = ["text1", "text2", "text3", "text4", "text5"]
        embeddings = embed_books.get_embeddings(texts)
        
        self.assertEqual(len(embeddings), 5)
        self.assertEqual(len(embeddings[0]), 3072)
        mock_create.assert_called_once()
        args, kwargs = mock_create.call_args
        self.assertEqual(kwargs["input"], texts)
        self.assertEqual(kwargs["model"], "text-embedding-3-large")
        self.assertEqual(kwargs["dimensions"], 3072)

    @patch("embed_books.get_pinecone_index")
    @patch("embed_books.get_embeddings")
    @patch("os.listdir")
    @patch("builtins.open")
    def test_main_pipeline_checkpointing(self, mock_open, mock_listdir, mock_get_embeddings, mock_get_index):
        """Test that main loop respects checkpointing."""
        # Mock Pinecone index
        mock_index = MagicMock()
        mock_get_index.return_value = mock_index
        
        # Mock files in directories
        def side_effect_listdir(path):
            if "scraped_first_aid_final" in path:
                return ["01_file.md", "02_file.md"]
            if "scraped_pathoma" in path:
                return []
            return []
        mock_listdir.side_effect = side_effect_listdir
        
        # Mock file content
        mock_text_file = MagicMock()
        mock_text_file.read.return_value = "# Chapter\nSome text here.\n"
        mock_text_file.__enter__.return_value = mock_text_file
        
        # We need to allow real open for the checkpoint file
        def side_effect_open(file, *args, **kwargs):
            if "test_checkpoint.json" in str(file):
                return real_open(file, *args, **kwargs)
            return mock_text_file
        mock_open.side_effect = side_effect_open
        
        # Mock embeddings
        mock_get_embeddings.return_value = [[0.1]*3072] * 2 
        
        # Scenario 1: Fresh start
        with patch("embed_books.chunk_markdown") as mock_chunk:
            # chunk_markdown returns 5 chunks
            mock_chunk.return_value = [{"text": f"chunk {i}", "metadata": {"book": "Book", "chapter": "Ch", "section": "Sec", "subsection": "Sub", "image_ids": []}} for i in range(5)]
            
            # Set small batch size for testing
            with patch("embed_books.BATCH_SIZE", 2):
                embed_books.main()
            
            # Should have called upsert multiple times (01_file: 3 calls, 02_file: 3 calls)
            # 5 chunks / batch 2 -> batches: [0,1], [2,3], [4] -> 3 calls per file
            self.assertEqual(mock_index.upsert.call_count, 6)
            
            # Final checkpoint should be 02_file.md and index 4
            checkpoint = embed_books.load_checkpoint()
            self.assertEqual(checkpoint["last_book"], "First Aid for the USMLE Step 1 2023")
            self.assertEqual(checkpoint["last_file"], "02_file.md")
            self.assertEqual(checkpoint["last_chunk_index"], 4)

        # Scenario 2: Resume from checkpoint
        mock_index.upsert.reset_mock()
        # Resume from 01_file.md, index 2
        embed_books.save_checkpoint("First Aid for the USMLE Step 1 2023", "01_file.md", 2)
        
        with patch("embed_books.chunk_markdown") as mock_chunk:
            mock_chunk.return_value = [{"text": f"chunk {i}", "metadata": {"book": "First Aid for the USMLE Step 1 2023", "chapter": "Ch", "section": "Sec", "subsection": "Sub", "image_ids": []}} for i in range(5)]
            with patch("embed_books.BATCH_SIZE", 2):
                embed_books.main()
            
            # 01_file.md: start_idx = 3. chunks[3:5] = 2 chunks ([3,4]). 1 upsert.
            # 02_file.md: start_idx = 0. chunks[0:5] = 5 chunks. 3 upserts.
            # Total 4 upserts.
            self.assertEqual(mock_index.upsert.call_count, 4)
            
            # Final checkpoint should be 02_file.md and index 4
            checkpoint = embed_books.load_checkpoint()
            self.assertEqual(checkpoint["last_book"], "First Aid for the USMLE Step 1 2023")
            self.assertEqual(checkpoint["last_file"], "02_file.md")
            self.assertEqual(checkpoint["last_chunk_index"], 4)

if __name__ == "__main__":
    unittest.main()
