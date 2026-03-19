from chapter_resolver import get_chapter_from_toc

def test_get_chapter_from_toc():
    # TOC format: [level, title, page_num]
    toc = [
        [1, "Chapter 1: Intro", 1],
        [1, "Chapter 2: Heart", 10],
        [2, "Section 2.1", 12]
    ]
    assert get_chapter_from_toc(1, toc) == "Chapter 1: Intro"
    assert get_chapter_from_toc(5, toc) == "Chapter 1: Intro"
    assert get_chapter_from_toc(10, toc) == "Chapter 2: Heart"
    assert get_chapter_from_toc(12, toc) == "Chapter 2: Heart" # Inherit parent
