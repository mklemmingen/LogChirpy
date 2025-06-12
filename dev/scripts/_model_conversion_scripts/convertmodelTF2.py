#!/usr/bin/env python3
"""
Convert a TensorFlow 2 SavedModel to TensorFlow Lite format.

Usage:
    python3 convert_to_tflite.py \
        --saved_model_dir /path/to/faster-rcnn-inception-resnet-v2-tensorflow2-640x640-v1 \
        --output_tflite model.tflite \
        [--quantize {none,dynamic,float16,int8}] \
        [--representative_data representative_data.npy]
"""
import argparse
import sys
import numpy as np
import tensorflow as tf

def representative_dataset_generator(data_path, num_samples=100):
    """
    Yield representative data for post-training quantization.
    Expects a NumPy file of shape [N, height, width, channels].
    """
    data = np.load(data_path)
    for i in range(min(num_samples, data.shape[0])):
        # Single-sample batch, as uint8 or float32 depending on quantization requirements.
        yield [data[i:i+1].astype(np.float32)]

def convert(saved_model_dir, output_tflite, quantize="none", rep_data_path=None):
    # Load the SavedModel
    converter = tf.lite.TFLiteConverter.from_saved_model(saved_model_dir)

    # Select optimization & quantization
    if quantize == "dynamic":
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
    elif quantize == "float16":
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        converter.target_spec.supported_types = [tf.float16]
    elif quantize == "int8":
        if not rep_data_path:
            raise ValueError("Representative data required for int8 quantization.")
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        converter.representative_dataset = lambda: representative_dataset_generator(rep_data_path)
        # Ensure input/output are also quantized to uint8
        converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
        converter.inference_input_type = tf.uint8
        converter.inference_output_type = tf.uint8

    # Convert
    tflite_model = converter.convert()

    # Write to file
    with open(output_tflite, "wb") as f:
        f.write(tflite_model)
    print(f"✅ TFLite model written to: {output_tflite}")

def main():
    parser = argparse.ArgumentParser(
        description="Convert TensorFlow SavedModel to TFLite"
    )
    parser.add_argument(
        "--saved_model_dir", required=True,
        help="Path to the directory containing saved_model.pb"
    )
    parser.add_argument(
        "--output_tflite", default="model.tflite",
        help="Filename for the generated .tflite model"
    )
    parser.add_argument(
        "--quantize", choices=["none","dynamic","float16","int8"],
        default="none",
        help="Apply post-training quantization"
    )
    parser.add_argument(
        "--representative_data", required=False,
        help="Path to .npy file for representative dataset (needed for int8)"
    )
    args = parser.parse_args()

    try:
        convert(
            saved_model_dir=args.saved_model_dir,
            output_tflite=args.output_tflite,
            quantize=args.quantize,
            rep_data_path=args.representative_data
        )
    except Exception as e:
        print(f"❌ Error during conversion: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
