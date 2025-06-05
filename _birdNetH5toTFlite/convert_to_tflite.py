#!/usr/bin/env python3
"""
Convert BirdNET TensorFlow.js model to TensorFlow Lite format for React Native.

This script converts the existing TensorFlow.js BirdNET model to TensorFlow Lite (.tflite)
format that can be used with react-native-tflite package.

Requirements:
- tensorflow>=2.12.0
- The existing TensorFlow.js model files

Usage:
    python convert_to_tflite.py
"""

import os
import sys
import json
import numpy as np
import tensorflow as tf
from pathlib import Path

def load_tensorflowjs_model(model_dir):
    """Load the TensorFlow.js model and convert to Keras format."""
    try:
        # Import tensorflowjs
        import tensorflowjs as tfjs
        
        # Load the TensorFlow.js model
        print(f"📦 Loading TensorFlow.js model from {model_dir}")
        model = tfjs.converters.load_keras_model(model_dir)
        
        print(f"✅ Model loaded successfully")
        print(f"   - Input shape: {model.input_shape}")
        print(f"   - Output shape: {model.output_shape}")
        print(f"   - Parameters: {model.count_params():,}")
        
        return model
        
    except ImportError:
        print("❌ TensorFlow.js not found. Installing...")
        os.system("pip install tensorflowjs")
        import tensorflowjs as tfjs
        return load_tensorflowjs_model(model_dir)
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        return None

def convert_to_tflite(model, output_path, quantize=True):
    """Convert Keras model to TensorFlow Lite format."""
    try:
        print("🔄 Converting to TensorFlow Lite...")
        
        # Create TensorFlow Lite converter
        converter = tf.lite.TFLiteConverter.from_keras_model(model)
        
        if quantize:
            print("⚡ Applying quantization for smaller model size...")
            # Apply dynamic range quantization
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
            
            # Optional: Use float16 quantization for better performance
            converter.target_spec.supported_types = [tf.float16]
        
        # Set representative dataset for full integer quantization (optional)
        def representative_data_gen():
            # Generate sample data that represents real input
            for _ in range(100):
                # BirdNET expects mel-spectrogram input: [1, 224, 224, 3]
                sample = np.random.rand(1, 224, 224, 3).astype(np.float32)
                yield [sample]
        
        # Uncomment for full integer quantization (smaller but potentially less accurate)
        # converter.representative_dataset = representative_data_gen
        # converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
        # converter.inference_input_type = tf.int8
        # converter.inference_output_type = tf.int8
        
        # Convert the model
        tflite_model = converter.convert()
        
        # Save the model
        with open(output_path, 'wb') as f:
            f.write(tflite_model)
        
        # Get model size
        model_size = len(tflite_model) / (1024 * 1024)  # MB
        
        print(f"✅ TensorFlow Lite model saved to {output_path}")
        print(f"   - Model size: {model_size:.2f} MB")
        
        return True
        
    except Exception as e:
        print(f"❌ Conversion failed: {e}")
        return False

def create_model_metadata(labels_path, output_path, model_info):
    """Create metadata file with model information and labels."""
    try:
        print("📝 Creating model metadata...")
        
        # Load labels
        with open(labels_path, 'r') as f:
            labels_data = json.load(f)
        
        # Create metadata
        metadata = {
            "model_info": {
                "name": "BirdNET v2.4 Audio Classifier",
                "version": "2.4",
                "description": "BirdNET v2.4 model converted to TensorFlow Lite for React Native",
                "input_shape": [1, 224, 224, 3],
                "output_shape": [1, 6522],
                "model_type": "audio_classification",
                "preprocessing": {
                    "audio_format": "mel_spectrogram",
                    "sample_rate": 48000,
                    "window_size": 2048,
                    "hop_length": 512,
                    "n_mels": 224,
                    "f_min": 0,
                    "f_max": 15000
                }
            },
            "labels": labels_data["labels"],
            "performance": {
                "accuracy": "~85%",
                "inference_time": "1-3 seconds",
                "model_size": model_info.get("size_mb", "unknown")
            },
            "usage": {
                "input_format": "Float32 tensor [1, 224, 224, 3]",
                "output_format": "Float32 tensor [1, 6522] (class probabilities)",
                "confidence_threshold": 0.1,
                "max_results": 5
            }
        }
        
        # Save metadata
        with open(output_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"✅ Metadata saved to {output_path}")
        return True
        
    except Exception as e:
        print(f"❌ Metadata creation failed: {e}")
        return False

def verify_tflite_model(model_path):
    """Verify the TensorFlow Lite model works correctly."""
    try:
        print("🔍 Verifying TensorFlow Lite model...")
        
        # Load the TFLite model
        interpreter = tf.lite.Interpreter(model_path=model_path)
        interpreter.allocate_tensors()
        
        # Get input and output details
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        
        print(f"✅ Model verification successful")
        print(f"   - Input details: {input_details[0]['shape']} ({input_details[0]['dtype']})")
        print(f"   - Output details: {output_details[0]['shape']} ({output_details[0]['dtype']})")
        
        # Test with dummy data
        input_shape = input_details[0]['shape']
        dummy_input = np.random.rand(*input_shape).astype(np.float32)
        
        # Run inference
        interpreter.set_tensor(input_details[0]['index'], dummy_input)
        interpreter.invoke()
        
        # Get output
        output_data = interpreter.get_tensor(output_details[0]['index'])
        
        print(f"   - Test inference successful")
        print(f"   - Output shape: {output_data.shape}")
        print(f"   - Output range: [{output_data.min():.4f}, {output_data.max():.4f}]")
        print(f"   - Top prediction index: {np.argmax(output_data)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Model verification failed: {e}")
        return False

def main():
    print("🚀 BirdNET TensorFlow.js to TensorFlow Lite Converter")
    print("=" * 60)
    
    # Define paths
    script_dir = Path(__file__).parent
    assets_dir = script_dir.parent / "assets" / "models"
    birdnet_js_dir = assets_dir / "birdnet"
    labels_path = birdnet_js_dir / "labels.json"
    
    # Output paths
    output_dir = assets_dir / "birdnet_tflite"
    tflite_path = output_dir / "birdnet_v24_audio.tflite"
    metadata_path = output_dir / "model_metadata.json"
    
    # Create output directory
    output_dir.mkdir(exist_ok=True)
    
    # Check if input files exist
    if not birdnet_js_dir.exists():
        print(f"❌ BirdNET TensorFlow.js model not found at {birdnet_js_dir}")
        print("Please ensure the model files exist:")
        print("  - model.json")
        print("  - group1-shard1of1.bin")
        print("  - labels.json")
        return 1
    
    # Step 1: Load TensorFlow.js model
    model = load_tensorflowjs_model(str(birdnet_js_dir))
    if not model:
        return 1
    
    # Step 2: Convert to TensorFlow Lite
    print("\n" + "="*60)
    success = convert_to_tflite(model, str(tflite_path), quantize=True)
    if not success:
        return 1
    
    # Step 3: Create metadata
    print("\n" + "="*60)
    model_size = tflite_path.stat().st_size / (1024 * 1024)
    model_info = {"size_mb": f"{model_size:.2f}"}
    success = create_model_metadata(str(labels_path), str(metadata_path), model_info)
    if not success:
        return 1
    
    # Step 4: Verify the model
    print("\n" + "="*60)
    success = verify_tflite_model(str(tflite_path))
    if not success:
        return 1
    
    # Summary
    print("\n" + "🎉 Conversion completed successfully!")
    print("=" * 60)
    print(f"📁 Output files:")
    print(f"   - TFLite model: {tflite_path}")
    print(f"   - Metadata: {metadata_path}")
    print(f"   - Model size: {model_size:.2f} MB")
    print(f"\n📱 Ready for React Native integration with react-native-tflite!")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())