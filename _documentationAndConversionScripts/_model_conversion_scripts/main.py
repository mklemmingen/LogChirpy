#!/usr/bin/env python3
"""
Embed labels metadata into a MobileNetV2 bird-classifier TFLite model so it works with
@infinitered/react-native-mlkit-image-labeling (classifyImage()).

This script:
  - Loads your existing bird_classifier.tflite
  - Embeds NormalizationOptions for [-1,1] preprocessing
  - Attaches labels.txt as axis labels for the output tensor
  - Saves a new model `bird_classifier_metadata.tflite`

Usage:
  python3 embed_bird_labels.py
"""
import os
import sys
from tflite_support.metadata_writers import image_classifier
from tflite_support.metadata_writers import writer_utils

#------------------------------------------------------------------------------
# CONFIGURATION: adjust these paths if your files are named differently
#------------------------------------------------------------------------------
# Input model (exported from Keras/TensorFlow; must be single-input, single-output)
_MODEL_PATH = "bird_classifier.tflite"
# Labels file: one label per line, matching output indices 0..N-1
_LABEL_FILE = "labels.txt"
# Output model with embedded metadata
_OUTPUT_PATH = "bird_classifier_metadata.tflite"

#------------------------------------------------------------------------------
# NORMALIZATION: MobileNetV2 expects pixel values in [-1,1]
# MetadataWriter will embed these values so ML Kit automatically preprocesses inputs
#------------------------------------------------------------------------------
# mean = 127.5, std = 127.5 performs (pixel - 127.5) / 127.5
_INPUT_NORM_MEAN = [127.5]
_INPUT_NORM_STD  = [127.5]

#------------------------------------------------------------------------------
# MAIN SCRIPT
#------------------------------------------------------------------------------
def main():
    # Validate input files
    for path in (_MODEL_PATH, _LABEL_FILE):
        if not os.path.exists(path):
            print(f"ERROR: Required file '{path}' not found.", file=sys.stderr)
            sys.exit(1)

    # Load raw TFLite model into memory
    print(f"Loading TFLite model from '{_MODEL_PATH}'...")
    model_buffer = writer_utils.load_file(_MODEL_PATH)

    # Create the MetadataWriter for an image classification model
    print("Creating metadata writer for image classifier...")
    writer = image_classifier.MetadataWriter.create_for_inference(
        model_buffer,
        _INPUT_NORM_MEAN,
        _INPUT_NORM_STD,
        [_LABEL_FILE]
    )

    # (Optional) Inspect the generated metadata JSON
    print("-- Generated metadata JSON preview --")
    print(writer.get_metadata_json())
    print("------------------------------------")

    # Populate the metadata and write out the new TFLite model file
    print(f"Embedding metadata and saving to '{_OUTPUT_PATH}'...")
    populated_model = writer.populate()
    writer_utils.save_file(populated_model, _OUTPUT_PATH)
    print("Done. Your model is ready for ML Kit classifyImage().")

    # Suggest how to include in your React Native Expo project:
    print("\nNext steps:")
    print("1) Place '" + _OUTPUT_PATH + "' in your assets folder (e.g. assets/models/)")
    print("2) In your React Native code, refer to it in your ImageLabelingConfig:")
    print("   { bird: { model: require('./assets/models/" + _OUTPUT_PATH + "'),")
    print("             options: { confidenceThreshold: 0.5, maxResultCount: 5 } } }")
    print("3) Wrap your app in <ImageLabelingModelProvider> and use useImageLabeling('bird')")
    print("4) Now classifyImage(uri) will return bird names from your labels.txt.")

if __name__ == '__main__':
    main()