# Implementation Plan: Web Search Integration

## Overview

This implementation plan adds web search capabilities to the Local AI Assistant. The approach implements a conditional search system that queries external APIs (starting with Brave Search), extracts relevant snippets, includes them in model context, and cites sources in responses. The feature is user-controlled via a toggle and maintains the assistant's privacy-first principles.

## Tasks

- [ ] 1. Implement Search API Client
  - [ ] 1.1 Create SearchAPIClient interface
    - Define interface for search operations
    - Define SearchOptions and SearchResponse types
    - Define APIUsageStats interface
    - _Requirements: 1.1, 1.2_

  - [ ] 1.2 Implement BraveSearchClient
    - Create Brave Search API client class
    - Implement search() method with query parameters
    - Handle API authentication with X-Subscription-Token header
    - Parse and transform API responses
    - _Requirements: 1.1_

  - [ ]* 1.3 Write unit tests for BraveSearchClient
    - Test request formatting
    - Test response parsing
    - Test error handling
    - Mock API responses
    - _Requirements: 1.1_

- [ ] 2. Implement Snippet Extraction
  - [ ] 2.1 Create SnippetExtractor
    - Implement extractSnippets() method
    - Implement relevance scoring algorithm
    - Implement snippet truncation with sentence boundaries
    - Remove HTML tags and formatting
    - _Requirements: 1.2_

  - [ ] 2.2 Implement deduplication logic
    - Detect and remove duplicate snippets
    - Compare snippets by content similarity
    - _Requirements: 1.2_

  - [ ]* 2.3 Write unit tests for SnippetExtractor
    - Test relevance scoring
    - Test truncation logic
    - Test deduplication
    - _Requirements: 1.2_

  - [ ]* 2.4 Write property test for snippet length constraint
    - **Property 6: Snippet Length Constraint**
    - **Validates: Design requirement**

- [ ] 3. Implement Citation Formatting
  - [ ] 3.1 Create CitationFormatter
    - Implement formatCitations() method
    - Generate numbered citation markers
    - Extract domain from URLs
    - Format as markdown list
    - _Requirements: 1.3_

  - [ ]* 3.2 Write unit tests for CitationFormatter
    - Test markdown formatting
    - Test URL truncation
    - Test domain extraction
    - _Requirements: 1.3_

  - [ ]* 3.3 Write property test for citation format validity
    - **Property 7: Citation Format Validity**
    - **Validates: Requirements 1.3**

- [ ] 4. Implement Search Controller
  - [ ] 4.1 Create SearchController class
    - Implement isSearchEnabled() and setSearchEnabled()
    - Implement shouldSearch() heuristics
    - Implement search() orchestration method
    - Integrate SearchAPIClient, SnippetExtractor, CitationFormatter
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 4.2 Implement search result caching
    - Create in-memory cache with LRU eviction
    - Set 5-minute expiration
    - Limit to 10 cached queries
    - _Requirements: 1.1_

  - [ ] 4.3 Implement error handling
    - Handle API key missing
    - Handle rate limiting (HTTP 429)
    - Handle network timeouts
    - Handle invalid responses
    - Handle quota exhaustion
    - _Requirements: 1.1, 1.5_

  - [ ]* 4.4 Write unit tests for SearchController
    - Test search orchestration
    - Test caching behavior
    - Test error handling
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 4.5 Write property test for conditional search API calls
    - **Property 1: Conditional Search API Calls**
    - **Validates: Requirements 1.1, 1.5**

  - [ ]* 4.6 Write property test for context injection completeness
    - **Property 2: Context Injection Completeness**
    - **Validates: Requirements 1.2**

- [ ] 5. Implement Search UI Controls
  - [ ] 5.1 Create search toggle in settings UI
    - Add toggle switch for web search
    - Wire toggle to SearchController.setSearchEnabled()
    - Display current search state
    - _Requirements: 1.4_

  - [ ] 5.2 Create search indicator component
    - Design visual indicator (e.g., animated icon)
    - Show indicator during active search
    - Hide indicator when search completes
    - _Requirements: 1.6_

  - [ ] 5.3 Add API key configuration UI
    - Add input field for Brave Search API key
    - Store API key securely in IndexedDB
    - Display setup instructions when key is missing
    - _Requirements: 1.1_

  - [ ]* 5.4 Write unit tests for search UI controls
    - Test toggle state changes
    - Test indicator visibility
    - Test API key storage
    - _Requirements: 1.4, 1.6_

  - [ ]* 5.5 Write property test for search toggle persistence
    - **Property 4: Search Toggle Persistence**
    - **Validates: Requirements 1.4**

  - [ ]* 5.6 Write property test for search indicator visibility
    - **Property 5: Search Indicator Visibility**
    - **Validates: Requirements 1.6**

- [ ] 6. Integrate Search with Message Flow
  - [ ] 6.1 Modify message handler to use SearchController
    - Check if search is enabled before sending to model
    - Call SearchController.search() for eligible queries
    - Inject search context into model prompt
    - Append citations to model response
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 6.2 Implement context injection formatting
    - Format search snippets for model prompt
    - Add clear markers for search context
    - Ensure context fits within token limits
    - _Requirements: 1.2_

  - [ ]* 6.3 Write property test for source citation presence
    - **Property 3: Source Citation Presence**
    - **Validates: Requirements 1.3**

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and error conditions
- Initial implementation uses Brave Search API, but architecture supports other providers
- Search is disabled by default to maintain privacy-first approach
- API key is stored securely in IndexedDB, never in LocalStorage
