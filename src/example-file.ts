import { v4 as uuidv4 } from 'uuid';

export function createWorkingWorkflow() {
  const dataStore: any[] = [];
  let fetchedData: any = null;
  let recordIds: string[] = [];

  return {
    dataStore,
    fetchedData,
    recordIds,
    workflow: [
      {
        id: 'fetchRandomJSONData',
        handler: async () => {
          console.log('Fetching random JSON API data');
          
          const response = await fetch('https://jsonplaceholder.typicode.com/users');
          if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status}`);
          }
          
          fetchedData = await response.json();
          console.log('Fetched data count:', fetchedData.length);
          
          return Promise.resolve({ 
            valid: true, 
            count: fetchedData.length
          });
        },
        retries: 2,
        timeoutMs: 5000
      },
      {
        id: 'storeData',
        dependencies: ['fetchRandomJSONData'],
        handler: async () => {
          console.log('Storing fetched data in array');
          
          if (!fetchedData || !Array.isArray(fetchedData)) {
            throw new Error('No valid data available to store');
          }
          
          const recordsWithIds = fetchedData.map((user) => ({
            ...user,
            recordId: uuidv4(),
            createdAt: new Date().toISOString(),
            status: 'active'
          }));
          
          dataStore.push(...recordsWithIds);
          recordIds = recordsWithIds.map(record => record.recordId);
          
          console.log('Total records in store:', dataStore.length);
          
          return Promise.resolve({ 
            count: recordIds.length,
            storedAt: new Date().toISOString()
          });
        },
        retries: 1,
        timeoutMs: 2000
      },
      {
        id: 'fetchRecordDetails',
        dependencies: ['storeData'],
        handler: async () => {
          
          if (!recordIds || recordIds.length === 0) {
            throw new Error('No record IDs available');
          }
          
          const foundRecord = dataStore.filter(record => recordIds.includes(record.recordId))[0];
          if (!foundRecord) {
            throw new Error(`No records found for IDs: ${recordIds.join(', ')}`);
          }
          
          console.log('Found record:', foundRecord.recordId);
          
          const updatedRecord = {
            ...foundRecord,
            fetchedAt: new Date().toISOString(),
            status: 'fetched'
          };
          
          const recordIndex = dataStore.findIndex(r => r.recordId === updatedRecord.recordId);
          if (recordIndex !== -1) {
            dataStore[recordIndex] = updatedRecord;
          }

          console.log('Records fetched successfully');
          
          return Promise.resolve({ 
            fetched: true,
            recordData: updatedRecord
          });
        },
        retries: 2,
        timeoutMs: 3000
      },
      {
        id: 'updateRecordDetails',
        dependencies: ['fetchRecordDetails'],
        handler: async () => {
          console.log('Updating data for fetched records');
          
          if (!recordIds || recordIds.length === 0) {
            throw new Error('No record IDs available');
          }
          
          const recordToUpdate = dataStore.filter(record => recordIds.includes(record.recordId))[0];
          if (!recordToUpdate) {
            throw new Error(`No records found for IDs: ${recordIds.join(', ')}`);
          }
          
          const updatedRecord = {
            ...recordToUpdate,
            updatedAt: new Date().toISOString(),
            status: 'updated'
          };
          
          const recordIndex = dataStore.findIndex(r => r.recordId === updatedRecord.recordId);
          if (recordIndex !== -1) {
            dataStore[recordIndex] = updatedRecord;
          }
          
          console.log('Records updated successfully');
          console.log('Updated record id:', updatedRecord.recordId);
          
          return Promise.resolve({ 
            updated: true, 
            updatedRecord: updatedRecord,
            updatedAt: new Date().toISOString()
          });
        },
        retries: 3,
        timeoutMs: 2000
      }
    ]
  };
}

export function createFailedWorkflow() {
  const dataStore: any[] = [];
  let fetchedData: any = null;
  let recordIds: string[] = [];
  let attemptCount = 0;
  let fetchAttemptCount = 0;

  return {
    dataStore,
    fetchedData,
    recordIds,
    workflow: [
      {
        id: 'fetchRandomJSONData',
        handler: async () => {
          console.log('Fetching random JSON API data');
          
          attemptCount++;
          if (attemptCount === 1) {
            console.log('Network timeout - retrying');
            throw new Error('Network timeout - retrying');
          }

          const response = await fetch('https://jsonplaceholder.typicode.com/users');
          if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status}`);
          }
          
          fetchedData = await response.json();
          console.log('Fetched data count:', fetchedData.length);
          
          return Promise.resolve({ 
            valid: true, 
            count: fetchedData.length
          });
        },
        retries: 2,
        timeoutMs: 5000
      },
      {
        id: 'storeData',
        dependencies: ['fetchRandomJSONData'],
        handler: async () => {
          console.log('Storing fetched data in array');
          
          if (!fetchedData || !Array.isArray(fetchedData)) {
            throw new Error('No valid data available to store');
          }
          
          const currentAttempt = Math.floor(Math.random() * 3) + 1;
          if (currentAttempt === 1) {
            console.log('connection failed - retrying');
            throw new Error('connection failed - retrying');
          }
          
          const recordsWithIds = fetchedData.map((user) => ({
            ...user,
            recordId: uuidv4(),
            createdAt: new Date().toISOString(),
            status: 'active'
          }));
          
          dataStore.push(...recordsWithIds);
          recordIds = recordsWithIds.map(record => record.recordId);
          
          console.log('Total records in store:', dataStore.length);
          
          return Promise.resolve({ 
            count: recordIds.length,
            storedAt: new Date().toISOString()
          });
        },
        retries: 1,
        timeoutMs: 2000
      },
      {
        id: 'fetchRecordDetails',
        dependencies: ['storeData'],
        handler: async () => {
          
          if (!recordIds || recordIds.length === 0) {
            throw new Error('No record IDs available');
          }
          
          fetchAttemptCount++;
          if (fetchAttemptCount <= 2) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          const foundRecord = dataStore.filter(record => recordIds.includes(record.recordId))[0];
          if (!foundRecord) {
            throw new Error(`No records found for IDs: ${recordIds.join(', ')}`);
          }
          
          console.log('Found record:', foundRecord.recordId);
          
          const updatedRecord = {
            ...foundRecord,
            fetchedAt: new Date().toISOString(),
            status: 'fetched'
          };
          
          const recordIndex = dataStore.findIndex(r => r.recordId === updatedRecord.recordId);
          if (recordIndex !== -1) {
            dataStore[recordIndex] = updatedRecord;
          }

          console.log('Records fetched successfully');
          
          return Promise.resolve({ 
            fetched: true,
            recordData: updatedRecord
          });
        },
        retries: 2,
        timeoutMs: 1500
      },
      {
        id: 'updateRecordDetails',
        dependencies: ['fetchRecordDetails'],
        handler: async () => {
          console.log('Updating data for fetched records');
          
          if (!recordIds || recordIds.length === 0) {
            throw new Error('No record IDs available');
          }
          
          console.log('Permanent update failure - no retries');
          throw new Error('Update service permanently unavailable');
        },
        retries: 0,
        timeoutMs: 2000
      }
    ]
  };
}

export function createSkippedWorkflow() {
  const dataStore: any[] = [];
  let fetchedData: any = null;
  let recordIds: string[] = [];

  return {
    dataStore,
    fetchedData,
    recordIds,
    workflow: [
      {
        id: 'fetchRandomJSONData',
        handler: async () => {
          console.log('Fetching random JSON API data');
          
          console.log('Permanent network failure - no retries');
          throw new Error('Network permanently unavailable');
        },
        retries: 0,
        timeoutMs: 5000
      },
      {
        id: 'storeData',
        dependencies: ['fetchRandomJSONData'],
        handler: async () => {
          console.log('Storing fetched data in array');
          
          if (!fetchedData || !Array.isArray(fetchedData)) {
            throw new Error('No valid data available to store');
          }
          
          const recordsWithIds = fetchedData.map((user) => ({
            ...user,
            recordId: uuidv4(),
            createdAt: new Date().toISOString(),
            status: 'active'
          }));
          
          dataStore.push(...recordsWithIds);
          recordIds = recordsWithIds.map(record => record.recordId);
          
          console.log('Total records in store:', dataStore.length);
          
          return Promise.resolve({ 
            count: recordIds.length,
            storedAt: new Date().toISOString()
          });
        },
        retries: 1,
        timeoutMs: 2000
      },
      {
        id: 'fetchRecordDetails',
        dependencies: ['storeData'],
        handler: async () => {
          
          if (!recordIds || recordIds.length === 0) {
            throw new Error('No record IDs available');
          }
          
          const foundRecord = dataStore.filter(record => recordIds.includes(record.recordId))[0];
          if (!foundRecord) {
            throw new Error(`No records found for IDs: ${recordIds.join(', ')}`);
          }
          
          console.log('Found record:', foundRecord.recordId);
          
          const updatedRecord = {
            ...foundRecord,
            fetchedAt: new Date().toISOString(),
            status: 'fetched'
          };
          
          const recordIndex = dataStore.findIndex(r => r.recordId === updatedRecord.recordId);
          if (recordIndex !== -1) {
            dataStore[recordIndex] = updatedRecord;
          }

          console.log('Records fetched successfully');
          
          return Promise.resolve({ 
            fetched: true,
            recordData: updatedRecord
          });
        },
        retries: 2,
        timeoutMs: 3000
      },
      {
        id: 'updateRecordDetails',
        dependencies: ['fetchRecordDetails'],
        handler: async () => {
          console.log('Updating data for fetched records');
          
          if (!recordIds || recordIds.length === 0) {
            throw new Error('No record IDs available');
          }
          
          const recordToUpdate = dataStore.filter(record => recordIds.includes(record.recordId))[0];
          if (!recordToUpdate) {
            throw new Error(`No records found for IDs: ${recordIds.join(', ')}`);
          }
          
          const updatedRecord = {
            ...recordToUpdate,
            updatedAt: new Date().toISOString(),
            status: 'updated'
          };
          
          const recordIndex = dataStore.findIndex(r => r.recordId === updatedRecord.recordId);
          if (recordIndex !== -1) {
            dataStore[recordIndex] = updatedRecord;
          }
          
          console.log('Records updated successfully');
          console.log('Updated record id:', updatedRecord.recordId);
          
          return Promise.resolve({ 
            updated: true, 
            updatedRecord: updatedRecord,
            updatedAt: new Date().toISOString()
          });
        },
        retries: 3,
        timeoutMs: 2000
      }
    ]
  };
}
