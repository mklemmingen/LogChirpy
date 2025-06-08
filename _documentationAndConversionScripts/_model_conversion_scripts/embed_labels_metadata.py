#!/usr/bin/env python3
"""
Embed labels and normalization metadata into a TFLite object detection model

This script uses the TFLite Metadata Writer API to attach:
  - NormalizationOptions (mean and std) for FLOAT32 input tensors
  - A labels file for classification output

After running, the output `.tflite` file can be used directly with ML Kit's object detector,
which will automatically populate `label.text` and handle image normalization.
"""
import argparse
import sys
from tflite_support.metadata_writers import object_detector
from tflite_support.metadata_writers import writer_utils


def embed_metadata(input_model_path: str,
                   labels_paths: list[str],
                   output_model_path: str,
                   norm_mean: list[float],
                   norm_std: list[float]) -> None:
    # Load the existing TFLite model
    model_buffer = writer_utils.load_file(input_model_path)

    # Create a MetadataWriter for an object detection model
    writer = object_detector.MetadataWriter.create_for_inference(
        model_buffer,
        input_norm_mean=norm_mean,
        input_norm_std=norm_std,
        labels_file_paths=labels_paths
    )

    # Populate the metadata and write out the new model
    populated_model_buffer = writer.populate()
    writer_utils.save_file(populated_model_buffer, output_model_path)
    print(f"✅ Successfully wrote metadata-enriched model to: {output_model_path}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="Attach normalization and label metadata to a TFLite object detection model"
    )
    parser.add_argument(
        '--input_model', '-i',
        required=True,
        help="Path to the original .tflite model file"
    )
    parser.add_argument(
        '--labels', '-l',
        required=True,
        nargs='+',
        help="One or more paths to label files (e.g., labels.txt)"
    )
    parser.add_argument(
        '--output_model', '-o',
        required=True,
        help="Path where the new .tflite with metadata will be saved"
    )
    parser.add_argument(
        '--mean', '-m',
        type=float,
        nargs='+',
        default=[127.5],
        help="Normalization mean for each channel (default: [127.5])"
    )
    parser.add_argument(
        '--std', '-s',
        type=float,
        nargs='+',
        default=[127.5],
        help="Normalization std for each channel (default: [127.5])"
    )
    args = parser.parse_args()

    try:
        embed_metadata(
            input_model_path=args.input_model,
            labels_paths=args.labels,
            output_model_path=args.output_model,
            norm_mean=args.mean,
            norm_std=args.std
        )
    except Exception as e:
        print(f"❌ Error embedding metadata: {e}", file=sys.stderr)
        sys.exit(1)
