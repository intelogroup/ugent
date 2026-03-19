def get_chapter_from_toc(page_num, toc):
    """
    Resolves which chapter a page belongs to based on the PDF's internal Table of Contents (TOC).
    TOC format: list of lists [level, title, page_num]
    """
    current_chapter = "Unknown"
    for level, title, start_page in toc:
        if level == 1:
            if start_page <= page_num:
                current_chapter = title
            else:
                break
    return current_chapter
