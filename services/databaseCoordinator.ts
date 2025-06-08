// services/databaseCoordinator.ts - Database Operation Coordination for Tab Transitions
import { Platform } from 'react-native';

interface DatabaseOperation<T> {
    id: string;
    operation: () => Promise<T> | T;
    priority: 'high' | 'medium' | 'low';
    timestamp: number;
    resolve: (value: T) => void;
    reject: (error: any) => void;
}

interface DatabaseCoordinatorConfig {
    maxConcurrentOperations: number;
    operationTimeout: number;
    debounceTime: number;
    queueSizeLimit: number;
}

class DatabaseCoordinator {
    private static instance: DatabaseCoordinator;
    private operationQueue: DatabaseOperation<any>[] = [];
    private activeOperations = new Set<string>();
    private isProcessing = false;
    private debounceTimers = new Map<string, NodeJS.Timeout>();
    
    private config: DatabaseCoordinatorConfig = {
        maxConcurrentOperations: Platform.OS === 'android' ? 2 : 3,
        operationTimeout: 10000, // 10 seconds
        debounceTime: 150, // 150ms debounce
        queueSizeLimit: 50
    };

    public static getInstance(): DatabaseCoordinator {
        if (!DatabaseCoordinator.instance) {
            DatabaseCoordinator.instance = new DatabaseCoordinator();
        }
        return DatabaseCoordinator.instance;
    }

    /**
     * Execute a database operation with coordination and debouncing
     */
    public async executeOperation<T>(
        operationId: string,
        operation: () => Promise<T> | T,
        priority: 'high' | 'medium' | 'low' = 'medium',
        debounce: boolean = true
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            // Handle debouncing for similar operations
            if (debounce && this.debounceTimers.has(operationId)) {
                clearTimeout(this.debounceTimers.get(operationId));
            }

            const executeImmediately = !debounce || priority === 'high';
            
            const executeOperation = () => {
                // Check queue size limit
                if (this.operationQueue.length >= this.config.queueSizeLimit) {
                    reject(new Error('Database operation queue full'));
                    return;
                }

                // Remove any existing operation with same ID
                this.operationQueue = this.operationQueue.filter(op => op.id !== operationId);

                // Add new operation to queue
                this.operationQueue.push({
                    id: operationId,
                    operation,
                    priority,
                    timestamp: Date.now(),
                    resolve,
                    reject
                });

                // Sort queue by priority and timestamp
                this.operationQueue.sort((a, b) => {
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    const aPriority = priorityOrder[a.priority];
                    const bPriority = priorityOrder[b.priority];
                    
                    if (aPriority !== bPriority) {
                        return bPriority - aPriority; // Higher priority first
                    }
                    
                    return a.timestamp - b.timestamp; // Earlier timestamp first
                });

                // Start processing if not already running
                this.processQueue();
            };

            if (executeImmediately) {
                executeOperation();
            } else {
                // Debounce the operation
                const timer = setTimeout(executeOperation, this.config.debounceTime);
                this.debounceTimers.set(operationId, timer);
            }
        });
    }

    /**
     * Process the operation queue with concurrency control
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;

        try {
            while (this.operationQueue.length > 0 && this.activeOperations.size < this.config.maxConcurrentOperations) {
                const operation = this.operationQueue.shift();
                if (!operation) break;

                // Skip if operation is already active
                if (this.activeOperations.has(operation.id)) {
                    continue;
                }

                this.activeOperations.add(operation.id);

                // Execute operation with timeout
                this.executeWithTimeout(operation)
                    .finally(() => {
                        this.activeOperations.delete(operation.id);
                        // Continue processing queue
                        setTimeout(() => this.processQueue(), 0);
                    });
            }
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Execute operation with timeout protection
     */
    private async executeWithTimeout<T>(operation: DatabaseOperation<T>): Promise<void> {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Database operation ${operation.id} timed out after ${this.config.operationTimeout}ms`));
            }, this.config.operationTimeout);
        });

        try {
            const result = await Promise.race([
                Promise.resolve(operation.operation()),
                timeoutPromise
            ]);
            operation.resolve(result);
        } catch (error) {
            console.error(`Database operation ${operation.id} failed:`, error);
            operation.reject(error);
        }
    }

    /**
     * Cancel all pending operations (useful for tab switches)
     */
    public cancelPendingOperations(excludePriority?: 'high' | 'medium' | 'low'): void {
        const operationsToCancel = excludePriority 
            ? this.operationQueue.filter(op => op.priority !== excludePriority)
            : this.operationQueue;

        operationsToCancel.forEach(operation => {
            operation.reject(new Error('Operation cancelled due to navigation'));
        });

        if (excludePriority) {
            this.operationQueue = this.operationQueue.filter(op => op.priority === excludePriority);
        } else {
            this.operationQueue = [];
        }

        // Clear debounce timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
    }

    /**
     * Get queue status for debugging
     */
    public getQueueStatus(): {
        queueLength: number;
        activeOperations: number;
        isProcessing: boolean;
    } {
        return {
            queueLength: this.operationQueue.length,
            activeOperations: this.activeOperations.size,
            isProcessing: this.isProcessing
        };
    }

    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<DatabaseCoordinatorConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }
}

// Export singleton instance
export const databaseCoordinator = DatabaseCoordinator.getInstance();

// Convenience wrapper functions for common database operations
export const coordinatedDatabaseOperation = <T>(
    operationId: string,
    operation: () => Promise<T> | T,
    priority: 'high' | 'medium' | 'low' = 'medium',
    debounce: boolean = true
): Promise<T> => {
    return databaseCoordinator.executeOperation(operationId, operation, priority, debounce);
};

// Navigation-aware operation cancellation
export const cancelLowPriorityOperations = (): void => {
    databaseCoordinator.cancelPendingOperations('high');
};

export default databaseCoordinator;