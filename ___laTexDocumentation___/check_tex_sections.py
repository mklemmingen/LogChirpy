#!/usr/bin/env python3
"""
Check LaTeX files for section hierarchy issues and substantial text analysis.
Detects sections with minimal content and suggests merging opportunities.
"""

import re
import sys
from pathlib import Path
from collections import defaultdict

def count_substantial_text(text):
    """Count substantial text content, excluding LaTeX commands and whitespace."""
    # Remove LaTeX commands
    text = re.sub(r'\\[a-zA-Z]+\*?\{[^}]*\}', '', text)
    text = re.sub(r'\\[a-zA-Z]+\*?', '', text)
    # Remove comments
    text = re.sub(r'%.*$', '', text, flags=re.MULTILINE)
    # Remove itemize/enumerate environments but keep content
    text = re.sub(r'\\begin\{(itemize|enumerate)\}', '', text)
    text = re.sub(r'\\end\{(itemize|enumerate)\}', '', text)
    text = re.sub(r'\\item\s*', '', text)
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    # Count words (rough measure of substantial content)
    words = len([w for w in text.split() if len(w) > 2])
    return words, text

def check_tex_file(filepath):
    """Check a single .tex file for section hierarchy and content analysis."""
    
    # Read the file
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Regex patterns for sections
    section_pattern = re.compile(r'^\\(section|subsection|subsubsection)\{(.+?)\}')
    
    issues = []
    sections = []
    last_section_level = None
    last_section_line = 0
    
    for line_num, line in enumerate(lines, 1):
        match = section_pattern.match(line.strip())
        if match:
            level = match.group(1)
            title = match.group(2)
            
            # Calculate content since last section
            lines_between = line_num - last_section_line - 1 if last_section_line > 0 else 0
            
            # Extract text content between sections
            content = ''
            if last_section_line > 0:
                content_lines = lines[last_section_line:line_num-1]
                content = ''.join(content_lines)
            
            word_count, clean_text = count_substantial_text(content)
            
            # Map section levels to numbers for comparison
            level_map = {'section': 1, 'subsection': 2, 'subsubsection': 3}
            current_level = level_map[level]
            
            # Check for hierarchy issues
            if last_section_level is not None:
                # Check if we're jumping levels (e.g., section -> subsubsection)
                if current_level > last_section_level + 1:
                    issues.append({
                        'file': filepath.name,
                        'line': line_num,
                        'type': 'hierarchy',
                        'message': f"Jumped from {list(level_map.keys())[last_section_level-1]} to {level} (skipped intermediate level)",
                        'title': title
                    })
            
            # Store section info
            sections.append({
                'level': level,
                'title': title,
                'line': line_num,
                'lines_before': lines_between,
                'word_count': word_count,
                'content_preview': clean_text[:100] + '...' if len(clean_text) > 100 else clean_text
            })
            
            last_section_level = current_level
            last_section_line = line_num
    
    # Process the final section (after last section header to end of file)
    if sections:
        final_content_lines = lines[last_section_line:]
        final_content = ''.join(final_content_lines)
        final_word_count, final_clean_text = count_substantial_text(final_content)
        sections[-1]['word_count'] = final_word_count
        sections[-1]['content_preview'] = final_clean_text[:100] + '...' if len(final_clean_text) > 100 else final_clean_text
    
    return sections, issues

def print_report(all_sections, all_issues):
    """Print a formatted report of findings."""
    
    print("=" * 80)
    print("LaTeX Section Content & Structure Analysis")
    print("=" * 80)
    
    # Print hierarchy issues first
    if all_issues:
        print("\n❌ HIERARCHY ISSUES FOUND:")
        print("-" * 80)
        
        for issue in all_issues:
            print(f"\n📁 File: {issue['file']}")
            print(f"   Line {issue['line']}: {issue['message']}")
            print(f"   Section title: \"{issue['title']}\"")
    else:
        print("\n✅ No hierarchy issues found!")
    
    # Print section content analysis
    print("\n" + "=" * 80)
    print("CONTENT ANALYSIS & MERGE SUGGESTIONS:")
    print("=" * 80)
    
    for filename, sections in all_sections.items():
        if not sections:
            continue
            
        print(f"\n📄 {filename}")
        print("-" * 40)
        
        # Count sections by type
        section_counts = defaultdict(int)
        total_words = 0
        for s in sections:
            section_counts[s['level']] += 1
            total_words += s.get('word_count', 0)
        
        print(f"   Total sections: {len(sections)} | Total words: {total_words}")
        for level in ['section', 'subsection', 'subsubsection']:
            if section_counts[level] > 0:
                print(f"   - {level}s: {section_counts[level]}")
        
        # Analyze content and suggest merges
        print("\n   📊 CONTENT ANALYSIS:")
        merge_candidates = []
        
        for i, s in enumerate(sections):
            word_count = s.get('word_count', 0)
            level = s['level']
            title = s['title']
            
            # Identify sections with minimal content
            if word_count < 50 and level in ['subsection', 'subsubsection']:
                merge_candidates.append((i, s))
                print(f"   🔍 Line {s['line']}: {level} '{title[:30]}...' - {word_count} words")
                print(f"      Content: {s.get('content_preview', 'No content')[:80]}...")
                print(f"      💡 SUGGESTION: Consider merging - minimal content")
            elif word_count < 100 and level == 'subsection':
                print(f"   📝 Line {s['line']}: {level} '{title[:30]}...' - {word_count} words (short)")
            elif level == 'subsection' and word_count > 300:
                print(f"   📚 Line {s['line']}: {level} '{title[:30]}...' - {word_count} words (substantial)")
        
        # Check for files with many short subsections
        subsection_count = section_counts['subsection']
        if subsection_count >= 4:
            avg_words = total_words / len(sections) if sections else 0
            if avg_words < 100:
                print(f"\n   ⚠️  MERGE RECOMMENDATION: {subsection_count} subsections with avg {avg_words:.0f} words")
                print(f"      Consider consolidating multiple short subsections")
        
        print()

def analyze_specific_file(filepath, target_lines=None):
    """Analyze a specific file and optionally focus on specific lines."""
    
    sections, issues = check_tex_file(Path(filepath))
    
    print(f"\n🔍 DETAILED ANALYSIS: {Path(filepath).name}")
    print("=" * 60)
    
    for i, section in enumerate(sections):
        line_num = section['line']
        
        # If target_lines specified, only show those
        if target_lines and line_num not in target_lines:
            continue
            
        print(f"\n[{i+1}] Line {line_num}: \\{section['level']}{{{section['title']}}}")
        print(f"    Word count: {section.get('word_count', 0)}")
        print(f"    Content: {section.get('content_preview', 'No content')}")
        
        # Merge recommendation
        word_count = section.get('word_count', 0)
        if word_count < 30:
            print(f"    🚨 STRONG MERGE CANDIDATE: Very minimal content ({word_count} words)")
        elif word_count < 80:
            print(f"    ⚠️  MERGE CANDIDATE: Short content ({word_count} words)")
        else:
            print(f"    ✅ SUBSTANTIAL: Good content length ({word_count} words)")

def main():
    """Main function to check all .tex files in the src directory."""
    
    # Check for specific file analysis
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
        target_lines = None
        if len(sys.argv) > 2:
            try:
                target_lines = [int(x) for x in sys.argv[2].split(',')]
            except ValueError:
                print("Invalid line numbers. Use format: script.py filename.tex 25,50,75")
                sys.exit(1)
        
        if Path(filepath).exists():
            analyze_specific_file(filepath, target_lines)
            return 0
        else:
            print(f"File {filepath} not found!")
            sys.exit(1)
    
    # Find all .tex files in src directory
    src_dir = Path(__file__).parent / 'src'
    if not src_dir.exists():
        print(f"Error: Directory {src_dir} not found!")
        sys.exit(1)
    
    tex_files = list(src_dir.glob('*.tex'))
    
    if not tex_files:
        print(f"No .tex files found in {src_dir}")
        sys.exit(1)
    
    print(f"Checking {len(tex_files)} .tex files in {src_dir}...\n")
    
    all_sections = {}
    all_issues = []
    
    # Check each file
    for tex_file in sorted(tex_files):
        sections, issues = check_tex_file(tex_file)
        all_sections[tex_file.name] = sections
        all_issues.extend(issues)
    
    # Print report
    print_report(all_sections, all_issues)
    
    # Return exit code based on whether issues were found
    return 1 if all_issues else 0

if __name__ == "__main__":
    sys.exit(main())