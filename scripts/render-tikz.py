#!/usr/bin/env python3
"""
render-tikz.py — Extract TikZ environments from a .tex file,
render each to SVG using pdflatex + dvisvgm, save to demo public/diagrams/

Usage: python3 scripts/render-tikz.py [input.tex] [output-dir]
"""

import re
import sys
import os
import subprocess
import shutil

tex_file = sys.argv[1] if len(sys.argv) > 1 else "packages/demo-svelte/src/example.tex"
out_dir  = sys.argv[2] if len(sys.argv) > 2 else "packages/demo-svelte/public/diagrams"
work_dir = "/tmp/htex-tikz-render"

os.makedirs(out_dir, exist_ok=True)
os.makedirs(work_dir, exist_ok=True)

with open(tex_file) as f:
    content = f.read()

# Extract preamble
preamble_parts = content.split(r'\begin{document}', 1)
preamble = preamble_parts[0] if len(preamble_parts) > 1 else ''

# Extract color definitions — allow whitespace between braces
definecolors = re.findall(r'\\definecolor\s*\{[^}]+\}\s*\{[^}]+\}\s*\{[^}]+\}', preamble)
print(f"Found {len(definecolors)} color definitions")

# Find all tikzpicture environments (handles nested axis inside tikzpicture)
tikz_envs = []
pos = 0
while True:
    start = content.find(r'\begin{tikzpicture}', pos)
    if start == -1:
        break
    # Find matching \end{tikzpicture}
    end_tag = r'\end{tikzpicture}'
    end = content.find(end_tag, start)
    if end == -1:
        break
    tikz_envs.append(content[start : end + len(end_tag)])
    pos = end + len(end_tag)

print(f"Found {len(tikz_envs)} TikZ environments")

# Build standalone LaTeX preamble
LATEX_PREAMBLE = r"""\documentclass[tikz,border=6pt]{standalone}
\usepackage{tikz}
\usepackage{pgfplots}
\usepackage{xcolor}
\usepackage{amsmath}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usetikzlibrary{arrows.meta,positioning,fit,backgrounds,shadows,shapes.geometric,shapes.misc,calc,decorations.pathreplacing,decorations.markings,matrix,shapes.symbols}
\pgfplotsset{compat=1.18}
"""

for i, env in enumerate(tikz_envs):
    name = f"tikz-{i+1:02d}"
    tex_path = os.path.join(work_dir, f"{name}.tex")
    pdf_path = os.path.join(work_dir, f"{name}.pdf")
    svg_out  = os.path.join(out_dir, f"{name}.svg")

    # Build standalone document
    doc = LATEX_PREAMBLE
    for c in definecolors:
        doc += c + '\n'
    doc += r'\begin{document}' + '\n'
    doc += env + '\n'
    doc += r'\end{document}' + '\n'

    with open(tex_path, 'w') as f:
        f.write(doc)

    print(f"\n[{i+1}/{len(tikz_envs)}] Compiling {name}...")

    # Run pdflatex
    result = subprocess.run(
        ['pdflatex', '-interaction=nonstopmode', f'-output-directory={work_dir}', tex_path],
        capture_output=True, text=True, timeout=60
    )

    if not os.path.exists(pdf_path):
        print(f"  FAILED: pdflatex error")
        # Show last 10 lines of log
        log_path = os.path.join(work_dir, f"{name}.log")
        if os.path.exists(log_path):
            with open(log_path) as lf:
                lines = lf.readlines()
            errors = [l for l in lines if l.startswith('!') or 'Error' in l]
            for e in errors[:5]:
                print(f"    {e.strip()}")
        # Write error placeholder SVG
        with open(svg_out, 'w') as f:
            f.write(
                f'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="60">'
                f'<rect width="480" height="60" fill="#fff3f3" stroke="#f99" rx="4"/>'
                f'<text x="240" y="35" text-anchor="middle" font-family="monospace" '
                f'font-size="11" fill="#c66">[TikZ diagram {i+1} — render failed]</text>'
                f'</svg>'
            )
        continue

    # Convert PDF to SVG
    print(f"  Converting to SVG...")
    if shutil.which('pdf2svg'):
        r2 = subprocess.run(['pdf2svg', pdf_path, svg_out], capture_output=True, text=True, timeout=30)
    else:
        # dvisvgm --pdf
        r2 = subprocess.run(
            ['dvisvgm', '--pdf', '--no-fonts', '--zoom=1.4', f'--output={svg_out}', pdf_path],
            capture_output=True, text=True, cwd=work_dir, timeout=30
        )

    if os.path.exists(svg_out) and os.path.getsize(svg_out) > 100:
        size = os.path.getsize(svg_out)
        print(f"  OK: {svg_out} ({size:,} bytes)")
    else:
        print(f"  SVG conversion failed: {r2.stderr[:300]}")
        with open(svg_out, 'w') as f:
            f.write(
                f'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="60">'
                f'<rect width="480" height="60" fill="#f5f5f5" stroke="#ccc" rx="4"/>'
                f'<text x="240" y="35" text-anchor="middle" font-family="monospace" '
                f'font-size="11" fill="#888">[TikZ diagram {i+1}]</text>'
                f'</svg>'
            )

print(f"\nDone! SVGs written to {out_dir}/")
