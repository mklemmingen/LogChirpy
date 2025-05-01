import os
# use tensorflowjs to convert the model, Set the Python interpreter to Python 3.10 (not 3.13!)
os.system("tensorflowjs_converter --input_format=tf_saved_model --output_node_names='detection_boxes,detection_scores,detection_classes,num_detections' --saved_model_tags=serve saved_model tfjs_model/")
