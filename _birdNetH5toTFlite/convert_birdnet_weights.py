#!/usr/bin/env python3
"""
BirdNET H5 to TensorFlow.js Weight Converter
Converts the actual BirdNET H5 model weights to TensorFlow.js format.
"""

import os
import sys
import json
import numpy as np
from pathlib import Path

def check_dependencies():
    """Check if required dependencies are available."""
    try:
        import tensorflow as tf
        import tensorflowjs as tfjs
        print(f"✅ TensorFlow {tf.__version__} available")
        print(f"✅ TensorFlow.js {tfjs.__version__} available")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Please install: pip install tensorflow tensorflowjs")
        return False

def convert_h5_to_tfjs(h5_path, output_dir):
    """Convert H5 model to TensorFlow.js format."""
    try:
        import tensorflow as tf
        import tensorflowjs as tfjs
        
        print(f"📂 Loading H5 model from: {h5_path}")
        
        # Load the H5 model
        model = tf.keras.models.load_model(h5_path, compile=False)
        
        print(f"✅ Model loaded successfully")
        print(f"   Input shape: {model.input.shape}")
        print(f"   Output shape: {model.output.shape}")
        print(f"   Total parameters: {model.count_params():,}")
        
        # Print model summary
        print("\n📋 Model Architecture:")
        model.summary()
        
        # Convert to TensorFlow.js
        print(f"\n🔄 Converting to TensorFlow.js format...")
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Convert with quantization for smaller size
        tfjs.converters.save_keras_model(
            model, 
            output_dir,
            quantization_bytes=2,  # Use 16-bit quantization
            split_weights_by_layer=False
        )
        
        print(f"✅ Conversion completed successfully")
        print(f"📁 Model saved to: {output_dir}")
        
        # Check output file sizes
        print(f"\n📊 Output file sizes:")
        for file_path in Path(output_dir).glob('*'):
            size = file_path.stat().st_size
            if size > 1024 * 1024:
                size_str = f"{size / 1024 / 1024:.1f} MB"
            elif size > 1024:
                size_str = f"{size / 1024:.1f} KB"
            else:
                size_str = f"{size} bytes"
            print(f"   {file_path.name}: {size_str}")
        
        return True
        
    except Exception as e:
        print(f"❌ Conversion failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def update_model_config(output_dir, model_input_shape, model_output_shape):
    """Update model.json with correct architecture from the real model."""
    try:
        model_json_path = Path(output_dir) / "model.json"
        
        if model_json_path.exists():
            print(f"✅ TensorFlow.js model.json already created by converter")
            
            # Read and display the model config
            with open(model_json_path, 'r') as f:
                model_config = json.load(f)
            
            print(f"📋 Model format: {model_config.get('format', 'unknown')}")
            print(f"📋 Model topology layers: {len(model_config.get('modelTopology', {}).get('model_config', {}).get('config', {}).get('layers', []))}")
            
            return True
        else:
            print(f"❌ model.json not found after conversion")
            return False
            
    except Exception as e:
        print(f"❌ Error updating model config: {e}")
        return False

def main():
    """Main conversion function."""
    print("🐦 BirdNET H5 to TensorFlow.js Converter")
    print("=" * 50)
    
    # Check dependencies
    if not check_dependencies():
        return False
    
    # Define paths
    base_dir = Path(__file__).parent
    h5_model_path = base_dir / '_birdNetH5toTFlite' / 'BirdNET_v2.4_keras' / 'audio-model.h5'
    output_dir = base_dir / 'assets' / 'models' / 'birdnet_real'
    
    # Check if H5 model exists
    if not h5_model_path.exists():
        print(f"❌ H5 model not found: {h5_model_path}")
        print("Please ensure the BirdNET H5 model is in the correct location")
        return False
    
    print(f"📂 Input H5 model: {h5_model_path}")
    print(f"📂 Output directory: {output_dir}")
    print(f"📊 H5 model size: {h5_model_path.stat().st_size / 1024 / 1024:.1f} MB")
    
    # Convert the model
    print(f"\n🔄 Starting conversion...")
    success = convert_h5_to_tfjs(str(h5_model_path), str(output_dir))
    
    if not success:
        return False
    
    # Copy labels to the new directory
    labels_src = base_dir / 'assets' / 'models' / 'birdnet' / 'labels.json'
    labels_dst = output_dir / 'labels.json'
    
    if labels_src.exists():
        import shutil
        shutil.copy2(str(labels_src), str(labels_dst))
        print(f"✅ Labels copied to: {labels_dst}")
    
    print(f"\n✅ BirdNET model conversion completed successfully!")
    print(f"📁 Real model files are now in: {output_dir}")
    print(f"\n📋 Next steps:")
    print(f"1. Update TensorFlowLiteModelService to use: assets/models/birdnet_real/")
    print(f"2. Test the model with real audio files")
    print(f"3. Verify classification results are reasonable")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)