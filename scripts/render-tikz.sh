#!/bin/bash
# render-tikz.sh — Extract TikZ environments from a .tex file,
# render each to SVG using pdflatex + dvisvgm, save to demo public/diagrams/
#
# Usage: ./scripts/render-tikz.sh <input.tex> <output-dir>
# Example: ./scripts/render-tikz.sh packages/demo-svelte/src/example.tex packages/demo-svelte/public/diagrams

set -e

INPUT="${1:-packages/demo-svelte/src/example.tex}"
OUTDIR="${2:-packages/demo-svelte/public/diagrams}"
WORKDIR="/tmp/htex-tikz-render"

mkdir -p "$OUTDIR"
mkdir -p "$WORKDIR"

# Extract preamble colors + packages from the source tex
PREAMBLE_COLORS=$(python3 - <<'PYEOF'
import sys, re
with open(sys.argv[1] if len(sys.argv)>1 else "packages/demo-svelte/src/example.tex") as f:
    content = f.read()
# Extract \definecolor lines
colors = re.findall(r'\\definecolor\{[^}]+\}\{[^}]+\}\{[^}]+\}', content)
print('\n'.join(colors))
PYEOF
)

echo "Found colors: $(echo "$PREAMBLE_COLORS" | wc -l)"

# Extract all TikZ environments using Python
python3 << PYEOF
import re, sys, os

tex_file = "$INPUT"
out_dir = "$OUTDIR"
work_dir = "$WORKDIR"

with open(tex_file) as f:
    content = f.read()

# Extract preamble (everything before \begin{document})
preamble_match = re.split(r'\\begin\{document\}', content, 1)
preamble = preamble_match[0] if len(preamble_match) > 1 else ''

# Extract \definecolor lines
definecolors = re.findall(r'\\definecolor\{[^}]+\}\{[^}]+\}\{[^}]+\}', preamble)

# Extract pgfplotsset
pgfset = re.findall(r'\\pgfplotsset\{[^}]+\}', preamble)

# Find all tikzpicture environments (including nested axis)
tikz_pattern = re.compile(r'\\begin\{tikzpicture\}.*?\\end\{tikzpicture\}', re.DOTALL)
tikz_envs = tikz_pattern.findall(content)

print(f"Found {len(tikz_envs)} TikZ environments")

for i, env in enumerate(tikz_envs):
    out_name = f"tikz-{i+1:02d}"
    tex_path = os.path.join(work_dir, f"{out_name}.tex")
    
    # Build standalone LaTeX document
    standalone = r"""\documentclass[tikz,border=4pt]{standalone}
\usepackage{tikz}
\usepackage{pgfplots}
\usepackage{xcolor}
\usepackage{amsmath}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usetikzlibrary{arrows.meta,positioning,fit,backgrounds,shadows,shapes.geometric,shapes.misc,calc,decorations.pathreplacing,decorations.markings,matrix}
\pgfplotsset{compat=1.18}
"""
    # Add color definitions
    for c in definecolors:
        standalone += c + '\n'
    
    standalone += r"\begin{document}" + '\n'
    standalone += env + '\n'
    standalone += r"\end{document}" + '\n'
    
    with open(tex_path, 'w') as f:
        f.write(standalone)
    
    print(f"  Written: {tex_path}")
    
    # Compile with pdflatex
    import subprocess
    result = subprocess.run(
        ['pdflatex', '-interaction=nonstopmode', '-output-directory', work_dir, tex_path],
        capture_output=True, text=True, cwd=work_dir
    )
    
    pdf_path = os.path.join(work_dir, f"{out_name}.pdf")
    if not os.path.exists(pdf_path):
        print(f"  ERROR: pdflatex failed for {out_name}")
        print(result.stdout[-500:] if result.stdout else "")
        print(result.stderr[-500:] if result.stderr else "")
        # Create a placeholder SVG
        with open(os.path.join(out_dir, f"{out_name}.svg"), 'w') as f:
            f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80"><rect width="400" height="80" fill="#f5f5f5" stroke="#ccc"/><text x="200" y="45" text-anchor="middle" font-family="monospace" font-size="12" fill="#888">[TikZ diagram {i+1}]</text></svg>')
        continue
    
    # Convert PDF to SVG using pdf2svg or dvisvgm
    svg_path = os.path.join(out_dir, f"{out_name}.svg")
    
    # Try pdf2svg first, then dvisvgm
    import shutil
    if shutil.which('pdf2svg'):
        result2 = subprocess.run(['pdf2svg', pdf_path, svg_path], capture_output=True, text=True)
    else:
        result2 = subprocess.run(
            ['dvisvgm', '--pdf', '--no-fonts', f'--output={svg_path}', pdf_path],
            capture_output=True, text=True
        )
    
    if os.path.exists(svg_path):
        size = os.path.getsize(svg_path)
        print(f"  OK: {svg_path} ({size} bytes)")
    else:
        print(f"  ERROR converting to SVG: {result2.stderr[:200]}")
        # Fallback placeholder
        with open(svg_path, 'w') as f:
            f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80"><rect width="400" height="80" fill="#f5f5f5" stroke="#ccc"/><text x="200" y="45" text-anchor="middle" font-family="monospace" font-size="12" fill="#888">[TikZ diagram {i+1}]</text></svg>')

print("Done!")
PYEOF
