# How to Compile LaTeX to PDF

## Prerequisites

Before compiling LaTeX documents to PDF, ensure you have a LaTeX distribution installed:

- **Windows**: MiKTeX or TeX Live
- **macOS**: MacTeX (TeX Live)
- **Linux**: TeX Live (usually available via package manager)

## Basic Compilation Methods

### 1. Using pdflatex (Most Common)

```bash
pdflatex document.tex
```

For documents with references, citations, or table of contents, run multiple times:

```bash
pdflatex document.tex
pdflatex document.tex
pdflatex document.tex
```

### 2. Using latexmk (Automated)

Automatically handles multiple compilation passes:

```bash
latexmk -pdf document.tex
```

To clean auxiliary files:
```bash
latexmk -c
```

### 3. Using xelatex (For Unicode/Fonts)

Better support for modern fonts and Unicode:

```bash
xelatex document.tex
```

### 4. Using lualatex (Modern Alternative)

Supports Lua scripting and modern fonts:

```bash
lualatex document.tex
```

## Handling Bibliography

For documents with citations using BibTeX:

```bash
pdflatex document.tex
bibtex document
pdflatex document.tex
pdflatex document.tex
```

Or with biblatex/biber:

```bash
pdflatex document.tex
biber document
pdflatex document.tex
```

## Common Compilation Flags

- `-interaction=nonstopmode`: Continue despite errors
- `-file-line-error`: Show file and line for errors
- `-synctex=1`: Enable SyncTeX for PDF/source synchronization
- `-shell-escape`: Enable external program execution (use with caution)

Example:
```bash
pdflatex -interaction=nonstopmode -file-line-error document.tex
```

## IDE/Editor Integration

### VS Code
Install LaTeX Workshop extension, then use:
- `Ctrl/Cmd + Alt + B`: Build LaTeX project
- `Ctrl/Cmd + Alt + V`: View PDF

### TeXstudio
- `F5`: Quick Build
- `F1`: Build & View

### Overleaf
Online editor with automatic compilation

## Troubleshooting

### Missing Packages
If compilation fails due to missing packages:

- **MiKTeX**: Packages install automatically or use MiKTeX Console
- **TeX Live**: Use `tlmgr install packagename`

### File Not Found Errors
Ensure all included files (images, subfiles) are in the correct paths relative to the main `.tex` file.

### Memory Errors
For large documents:
```bash
pdflatex -extra-mem-top=10000000 document.tex
```

## Quick Reference

| Task | Command |
|------|---------|
| Simple PDF | `pdflatex document.tex` |
| With bibliography | `pdflatex → bibtex → pdflatex → pdflatex` |
| Automated build | `latexmk -pdf document.tex` |
| Unicode support | `xelatex document.tex` |
| Clean auxiliary files | `latexmk -c` |
| Continuous preview | `latexmk -pvc -pdf document.tex` |