#!/usr/bin/env python3
"""
Minimal bird image classification script using the LogChirpy MobileNetV2 model.

This script classifies a bird photo using the MobileNetV2-based image classifier
(bird_classifier_metadata.tflite) which recognizes 400 bird species.

NOTE: This is the IMAGE classification model (400 species).
      LogChirpy also ships a separate BirdNET v2.4 AUDIO model (6,522 species)
      located at assets/models/whoBIRD-TFlite-master/. The label files in
      assets/model_labels_whoBird/ (e.g. labels_de.txt) belong to the AUDIO
      model and must NOT be used with this image model.

Requirements:
    pip install tflite-runtime Pillow numpy

Usage:
    python3 classify_bird_image.py path/to/bird_photo.jpg

    # Optional: specify model and labels paths explicitly
    python3 classify_bird_image.py photo.jpg \
        --model ../../assets/models/birds_mobilenetv2/bird_classifier_metadata.tflite \
        --labels ../../assets/models/birds_mobilenetv2/labels.txt
"""
import argparse
import sys
import os
import zipfile
import numpy as np
from PIL import Image


def load_labels(labels_path: str) -> list[str]:
    """Load labels from a text file (one label per line)."""
    with open(labels_path, 'r', encoding='utf-8') as f:
        return [line.strip() for line in f if line.strip()]


def load_labels_from_tflite(model_path: str) -> list[str]:
    """Extract embedded labels from a TFLite model with metadata."""
    try:
        with zipfile.ZipFile(model_path, 'r') as z:
            for name in z.namelist():
                if name.endswith('.txt'):
                    content = z.read(name).decode('utf-8')
                    return [line.strip() for line in content.split('\n') if line.strip()]
    except zipfile.BadZipFile:
        pass
    return []


def preprocess_image(image_path: str, input_size: int = 224) -> np.ndarray:
    """
    Load and preprocess an image for MobileNetV2.
    - Resize to 224x224
    - Normalize pixels to [-1, 1] range (MobileNetV2 standard)
    """
    img = Image.open(image_path).convert('RGB')
    img = img.resize((input_size, input_size), Image.LANCZOS)
    img_array = np.array(img, dtype=np.float32)
    # MobileNetV2 normalization: (pixel - 127.5) / 127.5 maps [0,255] -> [-1,1]
    img_array = (img_array - 127.5) / 127.5
    # Add batch dimension: (224, 224, 3) -> (1, 224, 224, 3)
    return np.expand_dims(img_array, axis=0)


def classify(model_path: str, image_path: str, labels: list[str], top_k: int = 5):
    """Run inference and return top-k predictions."""
    import tflite_runtime.interpreter as tflite

    interpreter = tflite.Interpreter(model_path=model_path)
    interpreter.allocate_tensors()

    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    input_shape = input_details[0]['shape']  # Expected: [1, 224, 224, 3]
    input_size = input_shape[1]

    # Preprocess
    input_data = preprocess_image(image_path, input_size)

    # Run inference
    interpreter.set_tensor(input_details[0]['index'], input_data)
    interpreter.invoke()
    output_data = interpreter.get_tensor(output_details[0]['index'])[0]

    # The output is softmax probabilities (400 values)
    # Get top-k indices
    top_indices = np.argsort(output_data)[::-1][:top_k]

    results = []
    for idx in top_indices:
        label = labels[idx] if idx < len(labels) else f"Class {idx}"
        confidence = float(output_data[idx])
        results.append((label, confidence, int(idx)))

    return results


def main():
    # Determine repo root relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.abspath(os.path.join(script_dir, '..', '..'))

    default_model = os.path.join(
        repo_root, 'assets', 'models', 'birds_mobilenetv2',
        'bird_classifier_metadata.tflite'
    )
    default_labels = os.path.join(
        repo_root, 'assets', 'models', 'birds_mobilenetv2', 'labels.txt'
    )

    parser = argparse.ArgumentParser(
        description='Classify a bird image using the LogChirpy MobileNetV2 model'
    )
    parser.add_argument('image', help='Path to the bird image (JPG/PNG)')
    parser.add_argument('--model', '-m', default=default_model,
                        help='Path to bird_classifier_metadata.tflite')
    parser.add_argument('--labels', '-l', default=default_labels,
                        help='Path to labels.txt (or extract from model)')
    parser.add_argument('--top', '-k', type=int, default=5,
                        help='Number of top predictions to show (default: 5)')
    args = parser.parse_args()

    if not os.path.exists(args.image):
        print(f"Error: Image file not found: {args.image}", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(args.model):
        print(f"Error: Model file not found: {args.model}", file=sys.stderr)
        sys.exit(1)

    # Load labels: prefer standalone file, fall back to extracting from model
    if os.path.exists(args.labels):
        labels = load_labels(args.labels)
        print(f"Loaded {len(labels)} labels from {args.labels}")
    else:
        labels = load_labels_from_tflite(args.model)
        if labels:
            print(f"Extracted {len(labels)} labels from model metadata")
        else:
            print("Warning: No labels found. Results will show class indices only.",
                  file=sys.stderr)
            labels = []

    # Classify
    print(f"\nClassifying: {args.image}")
    print(f"Model: {os.path.basename(args.model)} (MobileNetV2, 400 species)\n")

    results = classify(args.model, args.image, labels, top_k=args.top)

    print(f"{'Rank':<6}{'Species':<40}{'Confidence':<12}{'Index'}")
    print("-" * 65)
    for i, (label, confidence, idx) in enumerate(results, 1):
        print(f"{i:<6}{label:<40}{confidence:>8.2%}    [{idx}]")


if __name__ == '__main__':
    main()
