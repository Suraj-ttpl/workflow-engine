export interface UserData {
  readonly id: number;
  readonly name: string;
  readonly username: string;
  readonly email: string;
  readonly address: {
    readonly street: string;
    readonly suite: string;
    readonly city: string;
    readonly zipcode: string;
    readonly geo: {
      readonly lat: string;
      readonly lng: string;
    };
  };
  readonly phone: string;
  readonly website: string;
  readonly company: {
    readonly name: string;
    readonly catchPhrase: string;
    readonly bs: string;
  };
}

export interface UserRecord extends UserData {
  readonly recordId: string;
  readonly createdAt: string;
  readonly status: 'active' | 'fetched' | 'updated';
  readonly fetchedAt?: string;
  readonly updatedAt?: string;
}

export interface ApiResponse<T> {
  readonly data: T;
  readonly status: number;
  readonly message?: string;
}

export interface FetchResult {
  readonly valid: boolean;
  readonly count: number;
  readonly error?: string;
}

export interface StoreResult {
  readonly count: number;
  readonly storedAt: string;
  readonly recordIds: readonly string[];
}

export interface FetchRecordResult {
  readonly fetched: boolean;
  readonly recordData: UserRecord;
  readonly error?: string;
}

export interface UpdateRecordResult {
  readonly updated: boolean;
  readonly recordId: string;
  readonly updatedAt: string;
  readonly error?: string;
}

export interface WorkflowState {
  readonly dataStore: readonly UserRecord[];
  readonly fetchedData: readonly UserData[] | null;
  readonly recordIds: readonly string[];
}

export interface TaskResult {
  readonly success: boolean;
  readonly data?: FetchResult | StoreResult | FetchRecordResult | UpdateRecordResult;
  readonly error?: string;
  readonly timestamp: string;
}

export interface WorkflowConfig {
  readonly dataStore: UserRecord[];
  readonly fetchedData: UserData[] | null;
  readonly recordIds: string[];
  readonly workflow: readonly Task[];
}

export interface Task {
  readonly id: string;
  readonly handler: () => Promise<unknown>;
  readonly dependencies?: readonly string[];
  readonly retries?: number;
  readonly timeoutMs?: number;
} 
