export interface JsonPlaceholderUser {
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

export interface UserRecord extends JsonPlaceholderUser {
  readonly recordId: string;
  readonly createdAt: string;
  readonly status: 'active' | 'fetched' | 'updated';
  readonly fetchedAt?: string;
  readonly updatedAt?: string;
}

export interface FetchResponse {
  readonly valid: boolean;
  readonly count: number;
}

export interface StoreResponse {
  readonly count: number;
  readonly storedAt: string;
}

export interface FetchRecordResponse {
  readonly fetched: boolean;
  readonly recordData: UserRecord;
}

export interface UpdateRecordResponse {
  readonly updated: boolean;
  readonly updatedRecord: UserRecord;
  readonly updatedAt: string;
}

export type DataStore = readonly UserRecord[];
export type FetchedData = JsonPlaceholderUser[] | null;

export interface WorkflowContext {
  readonly dataStore: DataStore;
  readonly fetchedData: FetchedData;
  readonly recordIds: readonly string[];
} 
