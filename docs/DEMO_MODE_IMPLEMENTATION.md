# Demo Mode Implementation

## Overview

Demo mode allows `demo.opulus.app` to run **without authentication** and **without making any network calls**. All data is mocked using static fixtures.

## Key Principle: **NO NETWORK CALLS IN DEMO MODE**

- ✅ **Backend**: Demo services return mock data directly (no database queries)
- ✅ **Frontend**: Demo API client returns mock data directly (no HTTP requests)
- ✅ **Type-safe**: Uses the same DTOs as production code

## Architecture

### Backend Flow

```
Request → detectDemoMode() middleware → Controller → getItemService(isDemo) → DemoItemService → Mock Data
                                                                              ↓
                                                                         NO DATABASE CALLS
```

### Frontend Flow

```
Hook → getApiClient() → DemoApiClient → Mock Data
                    ↓
              NO NETWORK CALLS
```

## Code Walkthrough

### 1. Demo Mode Detection

**Backend** (`opulus-backend/src/middleware/demo/demoMode.ts`):
```typescript
export function detectDemoMode(req: Request, res: Response, next: NextFunction) {
  const isDemoHostname = req.hostname === "demo.opulus.app";
  const isDemoEnv = config.demoMode; // DEMO_MODE=true
  (req as any).isDemoMode = isDemoHostname || isDemoEnv;
  next();
}
```

**Frontend** (`opulus-frontend/src/lib/api/demoClient.ts`):
```typescript
export const isDemoMode = (): boolean => {
  return (
    import.meta.env.VITE_DEMO_MODE === "true" ||
    window.location.hostname === "demo.opulus.app"
  );
};
```

### 2. Backend: Demo Service (No Database Calls)

**Demo Item Service** (`opulus-core/src/services/demo/demoItemService.ts`):
```typescript
class DemoItemService {
  async getAllByUserId(userId: string) {
    // Returns mock data directly - NO DATABASE CALLS
    return demoItems.map((item) => ({
      id: item.id,
      institutionName: item.institutionName,
      // ... mock data matching Prisma query shape
      bankAccounts: item.accounts.map(...),
    }));
  }
}
```

**Factory Function** (`opulus-core/src/services/getItemService.ts`):
```typescript
export function getItemService(forceDemoMode?: boolean) {
  const shouldUseDemo = forceDemoMode ?? isDemoMode();
  if (shouldUseDemo) {
    return demoItemService; // Returns mock data
  }
  return itemService; // Returns real database data
}
```

**Controller Usage** (`opulus-backend/src/controllers/items/getItemsController.ts`):
```typescript
export async function getItemsController(req: Request, res: Response, next: NextFunction) {
  const isDemo = getDemoMode(req);
  const session = await getSession(req.headers, isDemo); // Mock session in demo
  
  // Factory returns demo service in demo mode
  const itemService = getItemService(isDemo);
  const items = await itemService.getAllByUserId(userId); // NO DATABASE CALLS in demo
  
  res.json({ data: { items: publicItems } });
}
```

### 3. Frontend: Demo API Client (No Network Calls)

**Demo API Client** (`opulus-frontend/src/lib/api/demoClient.ts`):
```typescript
class DemoApiClient {
  async get<T>(url: string): Promise<{ data: T }> {
    // Simulate network delay (optional)
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    // Return mock data directly - NO NETWORK CALLS
    if (url === "/api/items") {
      return {
        data: {
          data: {
            items: demoItems, // Static mock data
          },
        } as T,
      };
    }
    
    return { data: {} as T };
  }
}
```

**Factory Function** (`opulus-frontend/src/lib/api/getApiClient.ts`):
```typescript
export function getApiClient() {
  if (isDemoMode()) {
    return demoApiClient; // Returns mock data
  }
  return apiClient; // Returns real axios client
}
```

**Hook Usage** (`opulus-frontend/src/hooks/items/useItems.ts`):
```typescript
const getItemsApi = async (): Promise<ItemsResponse['data']> => {
  // Factory returns demo client in demo mode
  const apiClient = getApiClient(); // NO NETWORK CALLS in demo
  const response = await apiClient.get<ItemsResponse>('/api/items');
  return response.data.data;
};
```

## Mock Data Structure

Mock data matches your DTOs exactly:

**Backend Mock Data** (`opulus-core/src/services/demo/demoData.ts`):
```typescript
export const demoItems: ItemPublicDTO[] = [
  {
    id: "demo-item-1",
    institutionName: "Chase Bank",
    accounts: [
      { id: "demo-account-1", name: "Chase Total Checking", ... },
    ],
  },
];
```

**Frontend Mock Data** (`opulus-frontend/src/lib/api/demoClient.ts`):
```typescript
const demoItems: ItemPublicDTO[] = [
  // Same structure as backend
];
```

## Authentication Bypass

**Demo Session** (`opulus-backend/src/services/session/getSession.ts`):
```typescript
export async function getSession(headers: IncomingHttpHeaders, isDemoMode?: boolean) {
  if (isDemoMode) {
    // Return mock session - NO AUTHENTICATION CHECK
    return {
      user: { id: "demo-user-id", email: "demo@opulus.app", ... },
      session: { id: "demo-session-id", ... },
    };
  }
  
  // Real authentication check
  return await auth.api.getSession({ headers });
}
```

## Protection Mechanisms

1. **No Database Writes**: Demo services never call Prisma
2. **No Network Calls**: Demo API client never makes HTTP requests
3. **No Server Exposure**: All data is static mock fixtures
4. **Type Safety**: Uses same DTOs as production

## Testing the Flow

### Backend Test:
```typescript
// In demo mode
const isDemo = true;
const itemService = getItemService(isDemo);
const items = await itemService.getAllByUserId("demo-user-id");
// Returns: mock data from demoItems
// NO DATABASE QUERY EXECUTED
```

### Frontend Test:
```typescript
// In demo mode
const apiClient = getApiClient(); // Returns demoApiClient
const response = await apiClient.get('/api/items');
// Returns: mock data from demoItems
// NO NETWORK REQUEST MADE
```

## Summary

✅ **No network calls** - Demo client returns mock data directly  
✅ **No database calls** - Demo services return mock data directly  
✅ **No authentication** - Mock session returned in demo mode  
✅ **Type-safe** - Uses same DTOs as production  
✅ **Maintainable** - Clear separation between demo and real implementations  
✅ **Protected** - Server details never exposed

