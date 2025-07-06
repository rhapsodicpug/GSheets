<<<<<<< HEAD

# Google Sheets Writer

A Mosaia Tool that writes summaries or data to a specified Google Sheet.

## Authentication Options

### Current Method: Service Account (Recommended)

- **Pros**: Secure, automatic, no user interaction
- **Cons**: Requires manual sheet sharing with service account email
- **Setup**: Share your Google Sheet with the service account email from your JSON key

### Alternative Methods (Future Enhancements)

#### 1. OAuth 2.0 Flow

- **Pros**: User grants permission once, works for all their sheets
- **Cons**: Requires user interaction during setup
- **Implementation**: Could add OAuth flow where agent asks user to authorize

#### 2. Google Apps Script Web App

- **Pros**: Can handle permissions automatically
- **Cons**: More complex setup, requires Apps Script deployment
- **Implementation**: Deploy as web app with proper permissions

#### 3. Google Workspace Add-on

- **Pros**: Native integration, automatic permissions
- **Cons**: Requires Google Workspace account, more complex development

## Automation Possibilities

### Sheet ID Discovery

Currently requires manual sheet ID input, but could be enhanced to:

- Search user's Google Drive for sheets by name
- Use Google Drive API to list available sheets
- Allow fuzzy matching of sheet names

### Permission Management

Could implement:

- Automatic sheet creation if it doesn't exist
- Permission request flow through OAuth
- Sheet sharing automation via Google Drive API

## Getting Started

1. Register for an account on mosaia.ai
2. Fork/copy this repo
3. Install the GitHub app to the repo by clicking the "Launch App" button on: https://mosaia.ai/org/mosaia/app/github
4. Fill out the `.mosaia` manifest file:

- `TOOL_DISPLAY_NAME`: (user-facing) The name of the tool, displayed on the Mosaia Tool Registry. Must be unique.
- `SHORT_TOOL_DESCRIPTION`: (user-facing) A one-sentence description of the tool, displayed in the Mosaia Tool Registry.
- `LONG_TOOL_DESCRIPTION`: (llm-facing) A longer description of what the tool does.
- `SHEET_ID`, `RANGE`, `SUMMARY`, etc. (llm-facing): Any params you wish the LLM to pass to your tool.
- `SHEET_ID_DESCRIPTION`, etc.: (llm-facing) Descriptions of each param and what they're for.
- `GOOGLE_SERVICE_ACCOUNT_KEY`: (user-facing): When a user adds your tool to their agent they will be asked to supply values to the keys listed in `envVars`.

5. Validate your `.mosaia` manifest file: `npm run validate:manifest`
6. (Optional) test your tool locally:
   - Start the server: `npm run start:dev` in one terminal
   - Run comprehensive tests: `npm run test:request` in another terminal
   - Or use PowerShell: `npm run test:request:ps`
   - A Postman collection has also been provided with a test request.
7. Push your changes to `main`. Once pushed, the deployment script will kick off. You should see your tool show up in `https://mosaia.ai/user/YOUR_USERNAME?tab=tools` in about a minute.
8. Add your tool to an agent to test it out.

## Manifest Validation

The project includes a validation script that checks your `.mosaia` manifest file against the required schema:

```bash
npm run validate:manifest
```

This script validates:

- **name**: Must be a string with minimum length 5, containing only alphanumeric characters and spaces
- **description**: Must be a string with minimum length 30
- **schema.type**: Must be "function"
- **schema.function.name**: Must be a string with minimum length 5
- **schema.function.description**: Must be a string with minimum length 30
- **schema.function.strict**: Must be a boolean (optional)
- **schema.function.parameters**: Must be a valid JSON schema object
- **envVars**: Must be an array of strings (optional)

See `.mosaia.example` for a valid manifest file structure.

## Minimum requirements

The only requirements for a Mosaia Tool are that it:

1. contains a valid `.mosaia` file
2. defines an npm `build` command
3. `npm run build` emits transpiled code into a `dist` directory
4. # the entrypoint of the transpiled code is `dist/index.js`.

# GSheets

> > > > > > > 6ecfe71a6d37a86578c9da7f71d4a188a31d0f61
