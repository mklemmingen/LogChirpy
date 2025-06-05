/**
 * Jest mock for react-native-fast-tflite
 */

export interface TensorflowModel {
  run: (inputs: any[]) => Promise<any[]>;
}

export const loadTensorflowModel = jest.fn().mockResolvedValue({
  run: jest.fn().mockResolvedValue([new Float32Array([0.8, 0.7, 0.5, 0.3, 0.1])])
});

export default {
  loadTensorflowModel
};