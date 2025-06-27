#!/usr/bin/env python3
"""
README.md Beautification Script

A standalone script for post-processing README.md files to improve formatting,
spacing, and visual presentation.

Author: Claude Code
"""

import re
import sys
from pathlib import Path
from typing import List

class ReadmeBeautifier:
    def __init__(self, readme_path: str = None):
        if readme_path is None:
            # Default to root README.md
            self.readme_path = Path(__file__).parent.parent / "README.md"
        else:
            self.readme_path = Path(readme_path)
    
    def beautify_spacing(self, content: str) -> str:
        """Improve spacing around different markdown elements"""
        lines = content.split('\n')
        beautified_lines = []
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Skip empty lines
            if not line:
                beautified_lines.append('')
                i += 1
                continue
            
            # Headers - add spacing before and after
            if line.startswith('#'):
                # Add space before header (except at start)
                if beautified_lines and beautified_lines[-1].strip():
                    beautified_lines.append('')
                beautified_lines.append(line)
                # Add space after header if next line isn't empty
                if i < len(lines) - 1 and lines[i+1].strip():
                    beautified_lines.append('')
            
            # Images - center and add spacing
            elif line.startswith('!['):
                if beautified_lines and beautified_lines[-1].strip():
                    beautified_lines.append('')
                # Center images with HTML
                beautified_lines.append('<div align="center">')
                beautified_lines.append(line)
                beautified_lines.append('</div>')
                if i < len(lines) - 1 and lines[i+1].strip():
                    beautified_lines.append('')
            
            # Tables - add spacing
            elif line.startswith('|'):
                if beautified_lines and beautified_lines[-1].strip() and not beautified_lines[-1].startswith('|'):
                    beautified_lines.append('')
                beautified_lines.append(line)
                # Look ahead for end of table
                j = i + 1
                while j < len(lines) and lines[j].strip().startswith('|'):
                    j += 1
                    beautified_lines.append(lines[j-1].strip())
                i = j - 1
                if i < len(lines) - 1 and lines[i+1].strip():
                    beautified_lines.append('')
            
            # Code blocks - add spacing
            elif line.startswith('```'):
                if beautified_lines and beautified_lines[-1].strip():
                    beautified_lines.append('')
                beautified_lines.append(line)
                # Find end of code block
                i += 1
                while i < len(lines) and not lines[i].strip().startswith('```'):
                    beautified_lines.append(lines[i])
                    i += 1
                if i < len(lines):
                    beautified_lines.append(lines[i].strip())  # Closing ```
                if i < len(lines) - 1 and lines[i+1].strip():
                    beautified_lines.append('')
            
            # Horizontal rules - add spacing
            elif line.startswith('---'):
                if beautified_lines and beautified_lines[-1].strip():
                    beautified_lines.append('')
                beautified_lines.append(line)
                if i < len(lines) - 1 and lines[i+1].strip():
                    beautified_lines.append('')
            
            # Blockquotes - improve formatting
            elif line.startswith('>'):
                if beautified_lines and beautified_lines[-1].strip() and not beautified_lines[-1].startswith('>'):
                    beautified_lines.append('')
                beautified_lines.append(line)
                # Look ahead for end of blockquote
                if i < len(lines) - 1 and not lines[i+1].strip().startswith('>') and lines[i+1].strip():
                    beautified_lines.append('')
            
            # Lists - ensure proper spacing
            elif line.startswith(('- ', '* ', '+ ')) or re.match(r'^\d+\. ', line):
                # Add space before list if previous line isn't a list item
                if (beautified_lines and beautified_lines[-1].strip() and 
                    not beautified_lines[-1].startswith(('- ', '* ', '+ ')) and
                    not re.match(r'^\d+\. ', beautified_lines[-1])):
                    beautified_lines.append('')
                beautified_lines.append(line)
            
            else:
                beautified_lines.append(line)
            
            i += 1
        
        return '\n'.join(beautified_lines)
    
    def improve_typography(self, content: str) -> str:
        """Improve typography and text formatting"""
        
        # Fix multiple spaces
        content = re.sub(r' +', ' ', content)
        
        # Improve punctuation spacing
        content = re.sub(r' ,', ',', content)
        content = re.sub(r' \.', '.', content)
        content = re.sub(r' ;', ';', content)
        content = re.sub(r' :', ':', content)
        
        # Fix quotes
        content = re.sub(r' "', ' "', content)
        content = re.sub(r'" ', '" ', content)
        
        # Improve dashes
        content = re.sub(r' - ', ' — ', content)
        content = re.sub(r'--', '—', content)
        
        # Fix ellipsis
        content = re.sub(r'\.{3}', '…', content)
        
        return content
    
    def add_badges(self, content: str) -> str:
        """Add project badges after the title"""
        lines = content.split('\n')
        
        # Find the first header (project title)
        for i, line in enumerate(lines):
            if line.startswith('# '):
                # Insert badges after subtitle/description
                j = i + 1
                while j < len(lines) and (lines[j].startswith('#') or lines[j].startswith('**') or not lines[j].strip()):
                    j += 1
                
                badges = [
                    '',
                    '[![TouchDesigner](https://img.shields.io/badge/TouchDesigner-2023.12120-orange)](https://derivative.ca/)',
                    '[![Python](https://img.shields.io/badge/Python-3.8+-blue)](https://python.org/)',
                    '[![MediaPipe](https://img.shields.io/badge/MediaPipe-0.10+-green)](https://mediapipe.dev/)',
                    '[![License](https://img.shields.io/badge/License-Academic-yellow)](LICENSE)',
                    ''
                ]
                
                # Insert badges
                for k, badge in enumerate(badges):
                    lines.insert(j + k, badge)
                break
        
        return '\n'.join(lines)
    
    def add_table_of_contents_links(self, content: str) -> str:
        """Improve table of contents with better formatting"""
        lines = content.split('\n')
        
        in_toc = False
        for i, line in enumerate(lines):
            if '## Table of Contents' in line:
                in_toc = True
                continue
            elif in_toc and line.startswith('##'):
                in_toc = False
            elif in_toc and line.startswith('- ['):
                # Improve TOC formatting with emojis and better structure
                # Keep TOC clean without emojis
                pass
        
        return '\n'.join(lines)
    
    def improve_code_blocks(self, content: str) -> str:
        """Improve code block formatting"""
        
        # Add language hints to bare code blocks
        content = re.sub(r'```\n(#!/usr/bin/env python|import |def |class )', r'```python\n\1', content)
        content = re.sub(r'```\n(#include|int main|void |printf)', r'```c\n\1', content)
        content = re.sub(r'```\n(npm |yarn |git |cd |ls |mkdir)', r'```bash\n\1', content)
        
        return content
    
    def cleanup_formatting(self, content: str) -> str:
        """Final cleanup of formatting issues"""
        
        # Remove excessive newlines
        content = re.sub(r'\n{4,}', '\n\n\n', content)
        
        # Fix spacing around horizontal rules
        content = re.sub(r'\n+---\n+', '\n\n---\n\n', content)
        
        # Clean up list formatting
        content = re.sub(r'\n- \n', '\n', content)
        
        # Fix header spacing
        content = re.sub(r'\n+(#+.*)\n+', r'\n\n\1\n\n', content)
        
        return content.strip()
    
    def beautify(self) -> str:
        """Apply all beautification steps"""
        if not self.readme_path.exists():
            raise FileNotFoundError(f"README.md not found at {self.readme_path}")
        
        with open(self.readme_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        print("🎨 Beautifying README.md...")
        
        # Apply beautification steps
        content = self.beautify_spacing(content)
        content = self.improve_typography(content)
        content = self.add_badges(content)
        content = self.add_table_of_contents_links(content)
        content = self.improve_code_blocks(content)
        content = self.cleanup_formatting(content)
        
        return content
    
    def write_beautified(self) -> None:
        """Write the beautified content back to the file"""
        beautified_content = self.beautify()
        
        with open(self.readme_path, 'w', encoding='utf-8') as f:
            f.write(beautified_content)
        
        print(f"✨ Successfully beautified README.md at {self.readme_path}")

def main():
    """Main function to run the beautifier"""
    readme_path = sys.argv[1] if len(sys.argv) > 1 else None
    beautifier = ReadmeBeautifier(readme_path)
    beautifier.write_beautified()

if __name__ == "__main__":
    main()