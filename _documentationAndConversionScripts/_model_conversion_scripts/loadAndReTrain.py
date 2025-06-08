# loadAndReTrain.py
# This script loads an existing TFLite model and its labels.txt,
# wraps it with TensorFlow Lite Model Maker's object_detector,
# and exports a .tflite file with embedded metadata (labels & normalization).

from tflite_model_maker import object_detector
from tflite_model_maker.config import ExportFormat

# 1) Specify paths to your prebuilt model and labels file
MODEL_PATH = 'mobilenet_quant_v1_224.tflite'
LABELS_PATH = 'labels.txt'

# 2) Create a DataLoaderSpec for Model Maker
spec = object_detector.DataLoaderSpec(
    model_path=MODEL_PATH,
    label_path=LABELS_PATH
)

# 3) Instantiate the Model Maker object
eval_model = object_detector.create(spec)

# 4) Export with metadata for ML Kit
output_tflite = 'mobilenet_v1_224_with_meta.tflite'
eval_model.export(
    tflite_filename=output_tflite,
    export_format=[ExportFormat.TFLITE]
)

print(f"✅ Exported metadata-enriched model: {output_tflite}")