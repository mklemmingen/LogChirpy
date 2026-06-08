"""
Generate print-quality architecture and pipeline figures for the LaTeX paper.
Output: architecture.png and pipelines.png in the same directory.
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.patheffects as pe
import os

OUT = os.path.dirname(os.path.abspath(__file__))
DPI = 220

# ── Colour palette (print-safe, colourblind-friendly) ────────────────────────
C_BLUE   = '#2B6CB0'   # ML pillar
C_GREEN  = '#276749'   # BirDex pillar
C_AMBER  = '#B7791F'   # Logging pillar
C_INFRA  = '#553C9A'   # infrastructure bar
C_BG     = '#F7FAFC'   # panel background
C_BORDER = '#CBD5E0'   # border lines
C_TEXT   = '#1A202C'   # primary text
C_LIGHT  = '#EDF2F7'   # box fill
C_ARROW  = '#4A5568'   # arrows

plt.rcParams.update({
    'font.family': 'DejaVu Sans',
    'font.size': 9,
    'axes.linewidth': 0.8,
    'figure.facecolor': 'white',
    'axes.facecolor': 'white',
})

# ── FIGURE 1: ARCHITECTURE ────────────────────────────────────────────────────

fig1, ax = plt.subplots(figsize=(13.4, 5.8))
ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis('off')
fig1.patch.set_facecolor('white')

def rounded_box(ax, x, y, w, h, color, text_lines, title=None,
                title_color='white', alpha=1.0, lw=1.2):
    box = FancyBboxPatch((x, y), w, h,
                         boxstyle='round,pad=0.012',
                         linewidth=lw, edgecolor=color,
                         facecolor=color if title else C_LIGHT,
                         alpha=alpha, zorder=3)
    ax.add_patch(box)
    if title:
        # header band
        header = FancyBboxPatch((x, y + h - 0.13), w, 0.13,
                                boxstyle='round,pad=0.0',
                                linewidth=0, edgecolor=color,
                                facecolor=color, zorder=4)
        ax.add_patch(header)
        ax.text(x + w/2, y + h - 0.065, title,
                ha='center', va='center', fontsize=9.5,
                fontweight='bold', color=title_color, zorder=5)
    if text_lines:
        line_h = (h - (0.13 if title else 0) - 0.06) / max(len(text_lines), 1)
        for i, line in enumerate(text_lines):
            ypos = y + h - (0.13 if title else 0) - 0.04 - i * line_h - line_h/2
            bold = line.startswith('•')
            ax.text(x + 0.013, ypos, line,
                    ha='left', va='center',
                    fontsize=8.2 if bold else 8,
                    color=color if bold else C_TEXT,
                    fontweight='semibold' if bold else 'normal',
                    zorder=5)

# ── pillar 1: ML Processing ──
rounded_box(ax, 0.02, 0.18, 0.30, 0.72, C_BLUE,
            ['• BirdNET v2.4 Global 6K (FP32)',
             '  6,522 species, audio',
             '  + geo metadata model (FP16)',
             '',
             '• MobileNetV2 image classifier',
             '  400 species, 224×224 input',
             '  SSD detection gate',
             '',
             '• Unified sequential pipeline',
             '  eliminates A/V race conditions'],
            title='ML Processing')

# ── pillar 2: BirDex ──
rounded_box(ax, 0.355, 0.18, 0.29, 0.72, C_GREEN,
            ['• 33,241 species',
             '  Clements 2024 taxonomy',
             '',
             '• 6 languages',
             '  EN / DE / ES / FR / UK / AR',
             '  automated + GPT-4 fallback',
             '',
             '• 9,331 Wikimedia WebP images',
             '  organised by genus',
             '',
             '• SQLite local, offline-first'],
            title='BirDex Encyclopedia')

# ── pillar 3: Logging ──
rounded_box(ax, 0.668, 0.18, 0.312, 0.72, C_AMBER,
            ['• Multi-modal capture',
             '  photo / audio / GPS / notes',
             '',
             '• Draft persistence',
             '  LogDraftContext + SQLite',
             '',
             '• Optional cloud sync',
             '  Firebase Firestore',
             '',
             '• Archive with map view',
             '  OpenStreetMap + GeoJSON'],
            title='Logging System')

# ── infrastructure bar ──
infra = FancyBboxPatch((0.02, 0.04), 0.96, 0.11,
                       boxstyle='round,pad=0.01',
                       linewidth=1.2, edgecolor=C_INFRA,
                       facecolor='#EDE9FE', zorder=3)
ax.add_patch(infra)
ax.text(0.5, 0.095,
        'Supporting Infrastructure:  '
        'Firebase Auth  ·  Expo Router (React Native)  ·  '
        'i18n (6 languages)  ·  OpenStreetMap  ·  TFLite runtime',
        ha='center', va='center', fontsize=8.5,
        color=C_INFRA, fontweight='semibold', zorder=5)

# ── title ──
ax.text(0.5, 0.96, 'LogChirpy — System Architecture',
        ha='center', va='top', fontsize=12,
        fontweight='bold', color=C_TEXT)

plt.tight_layout(pad=0.3)
out1 = os.path.join(OUT, 'architecture.png')
fig1.savefig(out1, dpi=DPI, bbox_inches='tight', facecolor='white')
print(f'Saved {out1}')
plt.close(fig1)


# ── FIGURE 2: ML PIPELINES ────────────────────────────────────────────────────

fig2, axes = plt.subplots(1, 2, figsize=(13.4, 8.8))
fig2.patch.set_facecolor('white')
fig2.subplots_adjust(wspace=0.08, left=0.02, right=0.98, top=0.93, bottom=0.02)

def draw_pipeline(ax, color, title, steps):
    """
    steps: list of (label, sublabel) tuples.
    sublabel may be None.
    """
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')
    ax.set_facecolor('white')

    # title bar
    ax.text(0.5, 0.97, title, ha='center', va='top',
            fontsize=11, fontweight='bold', color=color)

    n = len(steps)
    top = 0.90
    bot = 0.04
    slot = (top - bot) / n
    bh = slot * 0.60
    gap = slot - bh

    for i, (label, sub) in enumerate(steps):
        y_center = top - i * slot - slot / 2
        y_box = y_center - bh / 2
        bx = 0.07
        bw = 0.86

        box = FancyBboxPatch((bx, y_box), bw, bh,
                             boxstyle='round,pad=0.015',
                             linewidth=1.4, edgecolor=color,
                             facecolor=C_LIGHT, zorder=3)
        ax.add_patch(box)

        if sub:
            ax.text(0.5, y_center + bh * 0.15, label,
                    ha='center', va='center',
                    fontsize=8.8, fontweight='bold',
                    color=color, zorder=5)
            ax.text(0.5, y_center - bh * 0.20, sub,
                    ha='center', va='center',
                    fontsize=7.8, color='#4A5568',
                    style='italic', zorder=5)
        else:
            ax.text(0.5, y_center, label,
                    ha='center', va='center',
                    fontsize=8.8, fontweight='bold',
                    color=color, zorder=5)

        # arrow to next
        if i < n - 1:
            y_arrow_top = y_box
            y_arrow_bot = y_box - gap + 0.005
            ax.annotate('', xy=(0.5, y_arrow_bot),
                        xytext=(0.5, y_arrow_top),
                        arrowprops=dict(arrowstyle='->', color=C_ARROW,
                                        lw=1.6), zorder=4)


# ── Audio pipeline ──
draw_pipeline(axes[0], C_BLUE, 'Audio Classification Pipeline', [
    ('Raw Audio Input',          '48 kHz · mono · 3-second window'),
    ('Pre-processing',           'bandpass 150–15,000 Hz · normalise to [−1, 1]'),
    ('Acoustic Model (FP32)',    'input ℝ¹×¹⁴⁴⁰⁰⁰ → sigmoid logits [6,522]'),
    ('Metadata Model (FP16)',    'input [lat, lon, week-cos] → prior [6,522]'),
    ('Score Blending',           'p = p_audio · (0.7 + 0.3 · p_geo)   [if GPS]'),
    ('Output',                   'top-5 species + confidence scores'),
])

# ── Image pipeline ──
draw_pipeline(axes[1], C_AMBER, 'Image Classification Pipeline', [
    ('Camera Frame',             'JPEG quality 0.3 · variable resolution'),
    ('SSD MobileNet V1 Gate',    'MLKit object detection · configurable threshold'),
    ('Frame rejected if no bird', '← skip frame, continue video loop'),
    ('MobileNetV2 Classifier',   'input ℝ¹×²²⁴×²²⁴×³ (norm. to [−1,1]) → [400]'),
    ('Softmax → Top-3',          'probabilities > 0.05 surfaced to user'),
    ('Sequential lock',          'unifiedMLPipelineService.ts · image-before-audio'),
])

fig2.suptitle('LogChirpy — ML Processing Pipelines',
              fontsize=12, fontweight='bold', color=C_TEXT, y=0.985)

out2 = os.path.join(OUT, 'pipelines.png')
fig2.savefig(out2, dpi=DPI, bbox_inches='tight', facecolor='white')
print(f'Saved {out2}')
plt.close(fig2)

print('Done.')
