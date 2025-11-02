# Bruno API Collections

This directory contains Bruno API collections for testing the Opulus backend APIs.

## Structure

```
bruno/
├── bruno.json              # Root collection config
├── variables.json           # Global variables
├── env.json                # Environment-specific variables (gitignored)
├── collections/
└── README.md               # This file
```

## Setup

1. Install [Bruno](https://www.usebruno.com/) if you haven't already
2. Open Bruno and select "Open Collection"
3. Navigate to the `bruno` folder
4. The collection will load with all sub-collections

## Variables

### Global Variables (`variables.json`)
Shared across all collections:
- `base_url`: Base URL for the API (default: `http://localhost:8080`)
- `test_email`: Test user email for authentication requests
- `test_password`: Test user password for authentication requests
- `test_name`: Test user name for registration requests

**Note:** Update these values in `variables.json` or `env.json` to match your test data.

### Environment Variables (`env.json`)
Environment-specific variables, create a copy of this file from `env.json.example`.
```


## Adding New Collections

1. Create a new folder in `collections/` (e.g., `collections/users/`)
2. Create `bruno.json`:
   ```json
   {
     "version": "1",
     "name": "Users API",
     "type": "collection"
   }
   ```
3. Create your endpoint files (`.bru` files)
4. Use `{{base_url}}` variable in URLs

## Adding New Endpoints

1. Create a new `.bru` file in the appropriate collection folder
2. Name it descriptively (e.g., `Get User Profile.bru`)
3. Use the template structure:
   ```bru
   meta {
     name: Endpoint Name
     type: http
     seq: 1
   }

   get {
     url: {{base_url}}/api/endpoint
     body: none
     auth: none
   }

   docs {
     # Endpoint Name
     
     Description of what this endpoint does.
   }
   ```

## Testing Flow

1. Make sure your backend server is running: `npm run dev`
2. Open the collection in Bruno
3. Start with authentication endpoints
4. Bruno automatically stores cookies for authenticated requests
5. Test protected endpoints after signing in

## Notes

- Bruno automatically handles cookies, so after signing in, all subsequent requests include the session cookie
- Use environment variables for different environments (dev, staging, production)
- Each collection is self-contained but shares global variables
