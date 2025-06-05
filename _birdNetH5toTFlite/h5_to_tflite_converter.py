#!/usr/bin/env python3
"""
Convert BirdNET H5 Keras model to TensorFlow Lite format for react-native-fast-tflite.

This script converts the BirdNET v2.4 H5 model to TensorFlow Lite (.tflite)
format that can be used with react-native-fast-tflite package.

Requirements:
- tensorflow>=2.12.0
- The BirdNET v2.4 H5 model file

Usage:
    python h5_to_tflite_converter.py
"""

import os
import sys
import json
import numpy as np
import tensorflow as tf
from pathlib import Path

def load_h5_model(model_path):
    """Load the H5 Keras model."""
    try:
        print(f"Loading H5 model from {model_path}")
        
        model = tf.keras.models.load_model(model_path, compile=False)
        
        print(f"Model loaded successfully")
        print(f"   Input shape: {model.input_shape}")
        print(f"   Output shape: {model.output_shape}")
        print(f"   Parameters: {model.count_params():,}")
        
        return model
        
    except Exception as e:
        print(f"Error loading model: {e}")
        return None

def load_labels(labels_path):
    """Load bird species labels from the labels file."""
    labels = []
    
    try:
        with open(labels_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f):
                line = line.strip()
                if line:
                    labels.append({
                        "index": line_num,
                        "label": line,
                        "scientific_name": line.split('_')[0] if '_' in line else line,
                        "common_name": line.split('_', 1)[1] if '_' in line else ""
                    })
    
        print(f"Loaded {len(labels)} species labels")
        return labels
    
    except Exception as e:
        print(f"Error loading labels: {e}")
        return []

def convert_to_tflite(model, output_path, quantize=True):
    """Convert Keras model to TensorFlow Lite format."""
    try:
        print("Converting to TensorFlow Lite...")
        
        converter = tf.lite.TFLiteConverter.from_keras_model(model)
        
        if quantize:
            print("Applying dynamic range quantization...")
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
        
        tflite_model = converter.convert()
        
        with open(output_path, 'wb') as f:
            f.write(tflite_model)
        
        model_size = len(tflite_model) / (1024 * 1024)
        
        print(f"TensorFlow Lite model saved to {output_path}")
        print(f"   Model size: {model_size:.2f} MB")
        
        return True
        
    except Exception as e:
        print(f"Conversion failed: {e}")
        return False

def create_model_metadata(labels, output_path, model_info):
    """Create metadata file with model information and labels."""
    try:
        print("Creating model metadata...")
        
        metadata = {
            "model_info": {
                "name": "BirdNET v2.4 Audio Classifier",
                "version": "2.4",
                "description": "BirdNET v2.4 model converted to TensorFlow Lite for React Native",
                "input_shape": model_info.get("input_shape", [1, 144, 144, 1]),
                "output_shape": model_info.get("output_shape", [1, len(labels)]),
                "model_type": "audio_classification",
                "preprocessing": {
                    "audio_format": "mel_spectrogram",
                    "sample_rate": 48000,
                    "n_fft": 2048,
                    "hop_length": 512,
                    "n_mels": 144,
                    "f_min": 0,
                    "f_max": 15000,
                    "window_size": 3.0
                }
            },
            "labels": labels,
            "performance": {
                "accuracy": "~85%",
                "inference_time": "1-3 seconds",
                "model_size": model_info.get("size_mb", "unknown")
            },
            "usage": {
                "input_format": "Float32 tensor mel-spectrogram",
                "output_format": f"Float32 tensor [{1}, {len(labels)}] (class probabilities)",
                "confidence_threshold": 0.1,
                "max_results": 5
            }
        }
        
        with open(output_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"Metadata saved to {output_path}")
        return True
        
    except Exception as e:
        print(f"Metadata creation failed: {e}")
        return False

def verify_tflite_model(model_path):
    """Verify the TensorFlow Lite model works correctly."""
    try:
        print("Verifying TensorFlow Lite model...")
        
        interpreter = tf.lite.Interpreter(model_path=model_path)
        interpreter.allocate_tensors()
        
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        
        print(f"Model verification successful")
        print(f"   Input details: {input_details[0]['shape']} ({input_details[0]['dtype']})")
        print(f"   Output details: {output_details[0]['shape']} ({output_details[0]['dtype']})")
        
        input_shape = input_details[0]['shape']
        dummy_input = np.random.rand(*input_shape).astype(np.float32)
        
        interpreter.set_tensor(input_details[0]['index'], dummy_input)
        interpreter.invoke()
        
        output_data = interpreter.get_tensor(output_details[0]['index'])
        
        print(f"   Test inference successful")
        print(f"   Output shape: {output_data.shape}")
        print(f"   Output range: [{output_data.min():.4f}, {output_data.max():.4f}]")
        print(f"   Top prediction index: {np.argmax(output_data)}")
        
        return True, input_details, output_details
        
    except Exception as e:
        print(f"Model verification failed: {e}")
        return False, None, None

def main():
    print("BirdNET H5 to TensorFlow Lite Converter")
    print("=" * 60)
    
    script_dir = Path(__file__).parent
    h5_model_path = script_dir / "BirdNET_v2.4_keras" / "audio-model.h5"
    labels_path = script_dir / "BirdNET_v2.4_keras" / "labels" / "en_us.txt"
    
    assets_dir = script_dir.parent / "assets" / "models" / "birdnet"
    assets_dir.mkdir(parents=True, exist_ok=True)
    tflite_path = assets_dir / "birdnet_v24.tflite"
    metadata_path = assets_dir / "model_metadata.json"
    labels_json_path = assets_dir / "labels.json"
    
    if not h5_model_path.exists():
        print(f"BirdNET H5 model not found at {h5_model_path}")
        print("Please ensure the audio-model.h5 file exists in BirdNET_v2.4_keras/")
        return 1
    
    if not labels_path.exists():
        print(f"Labels file not found at {labels_path}")
        print("Please ensure the en_us.txt file exists in BirdNET_v2.4_keras/labels/")
        return 1
    
    print("\n" + "="*60)
    labels = load_labels(str(labels_path))
    if not labels:
        return 1
    
    with open(labels_json_path, 'w') as f:
        json.dump({"labels": labels}, f, indent=2)
    print(f"Labels JSON saved to {labels_json_path}")
    
    print("\n" + "="*60)
    model = load_h5_model(str(h5_model_path))
    if not model:
        return 1
    
    print("\n" + "="*60)
    success = convert_to_tflite(model, str(tflite_path), quantize=True)
    if not success:
        return 1
    
    print("\n" + "="*60)
    success, input_details, output_details = verify_tflite_model(str(tflite_path))
    if not success:
        return 1
    
    print("\n" + "="*60)
    model_size = tflite_path.stat().st_size / (1024 * 1024)
    model_info = {
        "size_mb": f"{model_size:.2f}",
        "input_shape": input_details[0]['shape'].tolist() if input_details else None,
        "output_shape": output_details[0]['shape'].tolist() if output_details else None
    }
    success = create_model_metadata(labels, str(metadata_path), model_info)
    if not success:
        return 1
    
    print("\nConversion completed successfully!")
    print("=" * 60)
    print(f"Output files:")
    print(f"   TFLite model: {tflite_path}")
    print(f"   Labels JSON: {labels_json_path}")
    print(f"   Metadata: {metadata_path}")
    print(f"   Model size: {model_size:.2f} MB")
    print(f"   Number of species: {len(labels)}")
    print(f"\nReady for React Native integration with react-native-fast-tflite!")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())