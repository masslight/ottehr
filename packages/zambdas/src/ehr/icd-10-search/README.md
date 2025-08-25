# ICD-10-CM Search Endpoint

This endpoint provides fuzzy search functionality for ICD-10-CM diagnostic codes.

## Overview

The ICD-10-CM search endpoint allows users to search for billable ICD-10-CM diagnostic codes using either:

- Partial code matches (e.g., "A00" matches "A00.0", "A00.1", etc.)
- Code description text (e.g., "cholera" matches codes related to cholera)
- Fuzzy text matching (partial word matches within descriptions)

## Key Features

- **Billable Codes Only**: Returns only leaf-node codes that are billable to insurance
- **Fuzzy Search**: Matches partial words and phrases in code descriptions
- **Prioritized Results**: Results are scored and sorted by relevance
- **Performance Optimized**: XML data is parsed once and cached in memory
- **Comprehensive Coverage**: Uses the full ICD-10-CM tabular data (2026 version)

## API Specification

### Request

```http
POST /icd-10-search
Content-Type: application/json

{
  "search": "string - search term (required, non-empty)"
}
```

### Response

```http
200 OK
Content-Type: application/json

{
  "codes": [
    {
      "code": "A00.0",
      "display": "Cholera due to Vibrio cholerae 01, biovar cholerae"
    },
    {
      "code": "A00.1", 
      "display": "Cholera due to Vibrio cholerae 01, biovar eltor"
    }
  ]
}
```

### Error Response

```http
400 Bad Request / 500 Internal Server Error
Content-Type: application/json

{
  "message": "Error description"
}
```

## Search Algorithm

The search algorithm uses a scoring system to rank results:

1. **Exact code match** (score: 1000) - Highest priority
2. **Code starts with search term** (score: 900)
3. **Code contains search term** (score: 800)
4. **Exact description match** (score: 700)
5. **Description starts with search term** (score: 600)
6. **Description contains search term** (score: 500)
7. **Fuzzy word matching** (score: 200-400) - All search words found in description

Results are limited to the top 100 matches to maintain performance.

## Data Source

The endpoint uses the official ICD-10-CM tabular data file:

- **File**: `icd10cm_tabular_2026.xml`
- **Location**: `packages/zambdas/assets/icd-10-cm-tabular/`
- **Version**: 2026 (latest available)

## Billable Code Logic

Only leaf nodes in the ICD-10-CM hierarchy are returned, as these are the codes that can be billed to insurance. Parent/category codes are excluded as they are typically not billable.

## Examples

### Search by Code

```json
// Request
{"search": "A00"}

// Response - Returns all codes starting with A00
{
  "codes": [
    {"code": "A00.0", "display": "Cholera due to Vibrio cholerae 01, biovar cholerae"},
    {"code": "A00.1", "display": "Cholera due to Vibrio cholerae 01, biovar eltor"},
    {"code": "A00.9", "display": "Cholera, unspecified"}
  ]
}
```

### Search by Description

```json
// Request
{"search": "pneumonia"}

// Response - Returns codes containing "pneumonia" in description
{
  "codes": [
    {"code": "A01.03", "display": "Typhoid pneumonia"},
    {"code": "A02.22", "display": "Salmonella pneumonia"},
    // ... more results
  ]
}
```

### Fuzzy Search

```json
// Request  
{"search": "heart involvement"}

// Response - Matches codes where description contains both "heart" and "involvement"
{
  "codes": [
    {"code": "A01.02", "display": "Typhoid fever with heart involvement"}
  ]
}
```

## Performance Considerations

- XML parsing and code extraction happens once on first request
- Subsequent requests use cached in-memory data structure
- Results are limited to 100 matches to balance comprehensiveness with response time
- Cold starts may take 2-3 seconds due to XML parsing; warm requests are sub-second
