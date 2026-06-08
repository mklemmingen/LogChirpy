"""
Bird Image Classifier Benchmark
Runs the repo's MobileNetV2 TFLite model (birds_mobilenetv2) against
the Wikimedia Commons reference images stored locally, then plots results.
"""

import json
import re
import os
import sys
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from PIL import Image

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import warnings
warnings.filterwarnings('ignore')
import tensorflow as tf

# ── paths ────────────────────────────────────────────────────────────────────
REPO = '/home/user/LogChirpy'
MODEL_PATH  = f'{REPO}/assets/models/birds_mobilenetv2/bird_classifier_metadata.tflite'
LABELS_PATH = f'{REPO}/assets/models/birds_mobilenetv2/labels.txt'
MANIFEST    = f'{REPO}/assets/images/bird_images_manifest.json'
IMAGES_DIR  = f'{REPO}/assets/images/birds'
OUT_GRAPH   = f'{REPO}/dev/bird_classifier_benchmark.png'

# ── load labels ──────────────────────────────────────────────────────────────
with open(LABELS_PATH) as f:
    labels = [l.strip() for l in f if l.strip()]
print(f"Labels: {len(labels)}")

# ── cross-reference manifest → labels ────────────────────────────────────────
def normalize(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())

label_norm = {normalize(l): i for i, l in enumerate(labels)}

with open(MANIFEST) as f:
    manifest = json.load(f)['images']

matched = []
for sci_name, sp in manifest.items():
    if not sp.get('has_image'):
        continue
    key = normalize(sp['common_name'])
    if key in label_norm:
        img_path = os.path.join(IMAGES_DIR, sp['image_file'])
        if os.path.exists(img_path):
            matched.append({
                'path':       img_path,
                'common':     sp['common_name'],
                'family':     sp.get('family', 'Unknown'),
                'label_idx':  label_norm[key],
            })

print(f"Matched species with local images: {len(matched)}")

# ── load TFLite model ─────────────────────────────────────────────────────────
interp = tf.lite.Interpreter(MODEL_PATH)
interp.allocate_tensors()
inp_det = interp.get_input_details()[0]
out_det = interp.get_output_details()[0]

def preprocess(path):
    img = Image.open(path).convert('RGB').resize((224, 224))
    arr = np.array(img, dtype=np.float32)
    arr = (arr - 127.5) / 127.5          # MobileNetV2 standard normalisation
    return np.expand_dims(arr, 0)

# ── run inference ─────────────────────────────────────────────────────────────
results = []
for i, item in enumerate(matched):
    if i % 50 == 0:
        print(f"  {i}/{len(matched)} ...", flush=True)
    try:
        tensor = preprocess(item['path'])
        interp.set_tensor(inp_det['index'], tensor)
        interp.invoke()
        logits = interp.get_tensor(out_det['index'])[0]
        probs  = tf.nn.softmax(logits).numpy()

        top5_idx  = np.argsort(probs)[::-1][:5]
        top1_correct = (top5_idx[0] == item['label_idx'])
        top3_correct = (item['label_idx'] in top5_idx[:3])
        top5_correct = (item['label_idx'] in top5_idx)

        results.append({
            'common':       item['common'],
            'family':       item['family'],
            'label_idx':    item['label_idx'],
            'top1_pred':    top5_idx[0],
            'top1_name':    labels[top5_idx[0]],
            'top1_conf':    float(probs[top5_idx[0]]),
            'true_conf':    float(probs[item['label_idx']]),
            'top1_correct': top1_correct,
            'top3_correct': top3_correct,
            'top5_correct': top5_correct,
        })
    except Exception as e:
        print(f"  SKIP {item['common']}: {e}")

print(f"\nInference complete: {len(results)} images")

# ── accuracy numbers ──────────────────────────────────────────────────────────
n   = len(results)
top1 = sum(r['top1_correct'] for r in results) / n * 100
top3 = sum(r['top3_correct'] for r in results) / n * 100
top5 = sum(r['top5_correct'] for r in results) / n * 100
print(f"Top-1: {top1:.1f}%  |  Top-3: {top3:.1f}%  |  Top-5: {top5:.1f}%")

# confidence when correct / incorrect
correct_conf   = [r['top1_conf'] for r in results if r['top1_correct']]
incorrect_conf = [r['top1_conf'] for r in results if not r['top1_correct']]

# per-family accuracy (families with ≥ 3 species)
from collections import defaultdict
fam_correct = defaultdict(list)
for r in results:
    fam = r['family'].split('(')[0].strip()
    fam_correct[fam].append(r['top1_correct'])

fam_acc = {f: (sum(v)/len(v)*100, len(v))
           for f, v in fam_correct.items() if len(v) >= 3}
fam_sorted = sorted(fam_acc.items(), key=lambda x: x[1][0], reverse=True)

# ── plot ──────────────────────────────────────────────────────────────────────
fig = plt.figure(figsize=(16, 14))
fig.patch.set_facecolor('#0d1117')
DARK  = '#161b22'
GRID  = '#21262d'
GREEN = '#3fb950'
RED   = '#f85149'
BLUE  = '#58a6ff'
GOLD  = '#e3b341'
TEXT  = '#e6edf3'
MUTED = '#8b949e'

ax_style = dict(facecolor=DARK)

def style_ax(ax):
    for spine in ax.spines.values():
        spine.set_edgecolor(GRID)

plt.rcParams.update({'text.color': TEXT, 'axes.labelcolor': TEXT,
                     'xtick.color': MUTED, 'ytick.color': MUTED,
                     'font.family': 'monospace'})

# ── 1. Top-k bar chart ────────────────────────────────────────────────────────
ax1 = fig.add_subplot(2, 3, 1, **ax_style)
bars = ax1.bar(['Top-1', 'Top-3', 'Top-5'],
               [top1, top3, top5],
               color=[GREEN, BLUE, GOLD], width=0.5, zorder=3)
for bar, val in zip(bars, [top1, top3, top5]):
    ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
             f'{val:.1f}%', ha='center', va='bottom', color=TEXT, fontsize=12, fontweight='bold')
ax1.set_ylim(0, 110)
ax1.set_title('Top-k Accuracy', color=TEXT, fontsize=13, fontweight='bold', pad=10)
ax1.set_ylabel('Accuracy (%)', color=MUTED)
ax1.yaxis.grid(True, color=GRID, linestyle='--', alpha=0.6, zorder=0)
ax1.set_facecolor(DARK)
style_ax(ax1)

# ── 2. Confidence distribution ────────────────────────────────────────────────
ax2 = fig.add_subplot(2, 3, 2, **ax_style)
bins = np.linspace(0, 1, 26)
ax2.hist(correct_conf,   bins=bins, color=GREEN, alpha=0.75, label=f'Correct ({len(correct_conf)})',   zorder=3)
ax2.hist(incorrect_conf, bins=bins, color=RED,   alpha=0.75, label=f'Incorrect ({len(incorrect_conf)})', zorder=3)
ax2.set_title('Top-1 Confidence Distribution', color=TEXT, fontsize=13, fontweight='bold', pad=10)
ax2.set_xlabel('Confidence', color=MUTED)
ax2.set_ylabel('Count', color=MUTED)
ax2.legend(facecolor=DARK, edgecolor=GRID, labelcolor=TEXT)
ax2.yaxis.grid(True, color=GRID, linestyle='--', alpha=0.6, zorder=0)
style_ax(ax2)

# ── 3. Correct vs Incorrect pie ───────────────────────────────────────────────
ax3 = fig.add_subplot(2, 3, 3, **ax_style)
ax3.set_facecolor(DARK)
sizes  = [sum(r['top1_correct'] for r in results), sum(not r['top1_correct'] for r in results)]
colors = [GREEN, RED]
wedges, texts, autotexts = ax3.pie(
    sizes, colors=colors, autopct='%1.1f%%',
    startangle=90, pctdistance=0.7,
    wedgeprops={'edgecolor': DARK, 'linewidth': 2})
for at in autotexts:
    at.set_color(DARK); at.set_fontsize(12); at.set_fontweight('bold')
ax3.set_title(f'Top-1 Correct vs Incorrect\n(n={n})', color=TEXT, fontsize=13, fontweight='bold', pad=10)
ax3.legend([f'Correct ({sizes[0]})', f'Incorrect ({sizes[1]})'],
           loc='lower center', facecolor=DARK, edgecolor=GRID, labelcolor=TEXT)
style_ax(ax3)

# ── 4. True-class confidence CDF ─────────────────────────────────────────────
ax4 = fig.add_subplot(2, 3, 4, **ax_style)
all_true_conf = sorted([r['true_conf'] for r in results])
cdf = np.arange(1, len(all_true_conf)+1) / len(all_true_conf)
ax4.plot(all_true_conf, cdf, color=BLUE, linewidth=2)
ax4.axvline(np.median(all_true_conf), color=GOLD, linestyle='--', alpha=0.8,
            label=f'Median {np.median(all_true_conf):.3f}')
ax4.set_title('CDF: Confidence on True Class', color=TEXT, fontsize=13, fontweight='bold', pad=10)
ax4.set_xlabel('Confidence score for correct label', color=MUTED)
ax4.set_ylabel('Cumulative fraction', color=MUTED)
ax4.legend(facecolor=DARK, edgecolor=GRID, labelcolor=TEXT)
ax4.yaxis.grid(True, color=GRID, linestyle='--', alpha=0.4, zorder=0)
ax4.xaxis.grid(True, color=GRID, linestyle='--', alpha=0.4, zorder=0)
style_ax(ax4)

# ── 5. Per-family accuracy (top 15 families by count) ────────────────────────
ax5 = fig.add_subplot(2, 3, 5, **ax_style)
top_fam = sorted(fam_acc.items(), key=lambda x: x[1][1], reverse=True)[:15]
top_fam_sorted = sorted(top_fam, key=lambda x: x[1][0])
fnames = [f'{f} ({v[1]})' for f, v in top_fam_sorted]
faccs  = [v[0] for _, v in top_fam_sorted]
bar_colors = [GREEN if a >= 50 else RED for a in faccs]
ax5.barh(fnames, faccs, color=bar_colors, zorder=3)
ax5.axvline(top1, color=GOLD, linestyle='--', alpha=0.8, label=f'Overall {top1:.1f}%')
ax5.set_xlim(0, 110)
ax5.set_title('Top-1 Accuracy by Family\n(top 15 by count)', color=TEXT, fontsize=13, fontweight='bold', pad=10)
ax5.set_xlabel('Top-1 Accuracy (%)', color=MUTED)
ax5.legend(facecolor=DARK, edgecolor=GRID, labelcolor=TEXT)
ax5.xaxis.grid(True, color=GRID, linestyle='--', alpha=0.4, zorder=0)
ax5.tick_params(axis='y', labelsize=8)
style_ax(ax5)

# ── 6. Summary text panel ─────────────────────────────────────────────────────
ax6 = fig.add_subplot(2, 3, 6, **ax_style)
ax6.set_facecolor(DARK)
ax6.axis('off')

best5 = sorted(results, key=lambda r: r['true_conf'], reverse=True)[:5]
worst5 = sorted(results, key=lambda r: r['true_conf'])[:5]

summary = [
    f"{'═'*34}",
    f"  LogChirpy MobileNetV2 Benchmark",
    f"{'═'*34}",
    f"  Model:    birds_mobilenetv2 (400 cls)",
    f"  Tested:   {n} reference images",
    f"  Coverage: {n}/{len(labels)} labels matched",
    f"",
    f"  Top-1:  {top1:5.1f}%",
    f"  Top-3:  {top3:5.1f}%",
    f"  Top-5:  {top5:5.1f}%",
    f"",
    f"  Avg conf (correct):   {np.mean(correct_conf):.3f}" if correct_conf else "",
    f"  Avg conf (incorrect): {np.mean(incorrect_conf):.3f}" if incorrect_conf else "",
    f"",
    f"  Best predictions:",
]
for r in best5:
    mark = '✓' if r['top1_correct'] else '✗'
    summary.append(f"    {mark} {r['common'][:22]:22s} {r['true_conf']:.2f}")
summary += [f"", f"  Hardest predictions:"]
for r in worst5:
    mark = '✓' if r['top1_correct'] else '✗'
    summary.append(f"    {mark} {r['common'][:22]:22s} {r['true_conf']:.3f}")

ax6.text(0.05, 0.97, '\n'.join(summary),
         transform=ax6.transAxes, va='top', ha='left',
         fontsize=8.5, color=TEXT, fontfamily='monospace',
         linespacing=1.5)

# ── title ─────────────────────────────────────────────────────────────────────
fig.suptitle('LogChirpy — Image Classifier Benchmark (MobileNetV2 × Wikimedia Reference Images)',
             color=TEXT, fontsize=14, fontweight='bold', y=0.99)
plt.tight_layout(rect=[0, 0, 1, 0.98])
plt.savefig(OUT_GRAPH, dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
print(f"\nGraph saved → {OUT_GRAPH}")
