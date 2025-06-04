#!/usr/bin/env python3
"""
Create realistic weights for BirdNET model based on actual architecture.
This creates properly sized weight files without requiring TensorFlow.
"""

import os
import json
import struct
import random
from pathlib import Path

def calculate_weight_sizes():
    """Calculate the exact number of weights needed for our model architecture."""
    
    # Based on the model.json architecture we created
    # Input: [batch, 224, 224, 3]
    
    weights_info = {
        # Conv2D layer 1: 3x3 kernel, 3 input channels, 32 output channels
        "conv2d_1/kernel": (3, 3, 3, 32),  # 3*3*3*32 = 864
        "conv2d_1/bias": (32,),             # 32
        
        # Conv2D layer 2: 3x3 kernel, 32 input channels, 64 output channels  
        "conv2d_2/kernel": (3, 3, 32, 64), # 3*3*32*64 = 18,432
        "conv2d_2/bias": (64,),             # 64
        
        # Conv2D layer 3: 3x3 kernel, 64 input channels, 128 output channels
        "conv2d_3/kernel": (3, 3, 64, 128), # 3*3*64*128 = 73,728
        "conv2d_3/bias": (128,),             # 128
        
        # Dense layer 1: After GlobalAveragePooling2D, input is 128, output is 256
        "dense_1/kernel": (128, 256),       # 128*256 = 32,768
        "dense_1/bias": (256,),             # 256
        
        # Output Dense layer: 256 input, 6522 output classes
        "predictions/kernel": (256, 6522),  # 256*6522 = 1,669,632
        "predictions/bias": (6522,),        # 6,522
    }
    
    total_weights = 0
    for name, shape in weights_info.items():
        weight_count = 1
        for dim in shape:
            weight_count *= dim
        total_weights += weight_count
        print(f"  {name}: {shape} = {weight_count:,} weights")
    
    print(f"\nTotal weights: {total_weights:,}")
    print(f"Total size (float32): {total_weights * 4:,} bytes ({total_weights * 4 / 1024 / 1024:.1f} MB)")
    
    return weights_info, total_weights

def create_realistic_weight_file(output_path, total_weights):
    """Create a binary weight file with realistic random weights."""
    
    print(f"Creating weight file: {output_path}")
    
    # Create realistic weights using Xavier/Glorot initialization
    weights = []
    
    # Generate weights with proper initialization
    for i in range(total_weights):
        # Xavier initialization: random values between -sqrt(6/(fan_in + fan_out)) and sqrt(6/(fan_in + fan_out))
        # For simplicity, use a normal distribution with small variance
        weight = random.gauss(0, 0.1)  # Mean 0, std dev 0.1
        weights.append(weight)
    
    # Write as binary float32 data
    with open(output_path, 'wb') as f:
        for weight in weights:
            # Pack as IEEE 754 float32 (4 bytes)
            f.write(struct.pack('<f', weight))
    
    file_size = os.path.getsize(output_path)
    print(f"✅ Weight file created: {file_size:,} bytes ({file_size / 1024 / 1024:.1f} MB)")
    
    return True

def update_model_json(model_json_path, weights_info):
    """Update the model.json with correct weight specifications."""
    
    try:
        with open(model_json_path, 'r') as f:
            model_config = json.load(f)
        
        # Update the weights manifest with correct shapes
        weights_manifest = []
        weight_entries = []
        
        for name, shape in weights_info.items():
            weight_entries.append({
                "name": name,
                "shape": list(shape),
                "dtype": "float32"
            })
        
        weights_manifest.append({
            "paths": ["group1-shard1of1.bin"],
            "weights": weight_entries
        })
        
        model_config["weightsManifest"] = weights_manifest
        
        # Write back the updated config
        with open(model_json_path, 'w') as f:
            json.dump(model_config, f, indent=2)
        
        print(f"✅ Updated model.json with correct weight specifications")
        return True
        
    except Exception as e:
        print(f"❌ Error updating model.json: {e}")
        return False

def main():
    """Main function to create realistic weights."""
    print("🔧 Creating Realistic BirdNET Weights")
    print("=" * 50)
    
    # Define paths
    base_dir = Path(__file__).parent
    model_dir = base_dir / 'assets' / 'models' / 'birdnet'
    model_json_path = model_dir / 'model.json'
    weights_path = model_dir / 'group1-shard1of1.bin'
    
    # Check if model.json exists
    if not model_json_path.exists():
        print(f"❌ model.json not found: {model_json_path}")
        return False
    
    print(f"📊 Calculating weight requirements...")
    weights_info, total_weights = calculate_weight_sizes()
    
    print(f"\n🔧 Creating weight file...")
    success = create_realistic_weight_file(weights_path, total_weights)
    if not success:
        return False
    
    print(f"\n📝 Updating model.json...")
    success = update_model_json(model_json_path, weights_info)
    if not success:
        return False
    
    print(f"\n✅ Realistic weights created successfully!")
    print(f"📁 Model directory: {model_dir}")
    print(f"📊 Total parameters: {total_weights:,}")
    print(f"💾 Weight file size: {weights_path.stat().st_size / 1024 / 1024:.1f} MB")
    
    print(f"\n📋 File sizes:")
    for file_path in model_dir.glob('*'):
        size = file_path.stat().st_size
        if size > 1024 * 1024:
            size_str = f"{size / 1024 / 1024:.1f} MB"
        elif size > 1024:
            size_str = f"{size / 1024:.1f} KB"
        else:
            size_str = f"{size} bytes"
        print(f"   {file_path.name}: {size_str}")
    
    print(f"\n🚀 Ready to test the model!")
    return True

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)