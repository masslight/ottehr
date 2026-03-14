def truncate_notes(text, max_length=50):
    """
    Truncates the given text to a maximum of two lines, appending an ellipsis if the text is too long.
    """
    if len(text) <= max_length:
        return text
    else:
        truncated_text = text[:max_length - 3]
        last_space_index = truncated_text.rfind(' ')
        if last_space_index == -1:
            return truncated_text + '...'
        else:
            return truncated_text[:last_space_index] + '...'

# Test cases
def test_truncate_notes():
    test_cases = [
        ("This is a short note.", "This is a short note."),
        ("This is a very long note that needs to be truncated so that only two lines are displayed.", "This is a very long note that needs to be truncated so that only two lines are displayed..."),
        ("", ""),
        ("This note is just right, it fits on two lines perfectly.", "This note is just right, it fits on two lines perfectly."),
        ("This note is too short to be truncated.", "This note is too short to be truncated."),
        ("This is a test with multiple sentences. It should be truncated at the end of the second sentence.", "This is a test with multiple sentences. It should be truncated at the end of the second sentenc...")
    ]
    
    for original_text, expected_output in test_cases:
        assert truncate_notes(original_text) == expected_output, f"Failed for input: {original_text}"

# Run tests
test_truncate_notes()