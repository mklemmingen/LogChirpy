declare module 'base-64';

declare module 'react-native-fast-tflite' {
  export type TensorflowModelDelegate = 'GPU' | 'NNAPI' | 'CPU' | 'android-gpu' | 'core-ml' | 'default';
  
  export interface TensorflowModel {
    run(input: any): Promise<any>;
    runSync(input: any): any;
    release(): void;
  }
  
  export function loadTensorflowModel(config: any, delegate?: TensorflowModelDelegate): Promise<TensorflowModel>;
}

declare module 'react-native-permissions';