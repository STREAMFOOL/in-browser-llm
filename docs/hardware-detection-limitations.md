# Hardware Detection Limitations

## Browser Privacy Protections

Modern browsers intentionally limit hardware detection APIs for privacy reasons. This affects the accuracy of hardware profiles.

## RAM Detection (`navigator.deviceMemory`)

### How It Works
- Only available in Chromium-based browsers (Chrome, Edge, Brave)
- Returns a **quantized** value, not actual RAM
- Possible values: 0.25, 0.5, 1, 2, 4, 8 GB
- **Maximum value is 8 GB** even if you have more RAM

### Example
- If you have 16 GB RAM, the API reports: **4 GB or 8 GB**
- If you have 32 GB RAM, the API reports: **8 GB**
- This is intentional browser behavior for privacy

### Why This Matters
- The application uses this for feature gating
- Features requiring >8 GB RAM cannot be accurately detected
- When RAM is unknown (null), features are not disabled

## Storage Detection (`navigator.storage.estimate`)

### How It Works
- Available in most modern browsers
- Returns quota and usage information
- **Brave and Firefox often restrict this API**

### Common Issues

#### Brave Browser
- Often returns very small quotas (< 1 GB)
- May return 0 or negative available space
- This is due to Brave's privacy protections

#### Firefox
- May return restricted quota values
- Quota can be smaller than actual available disk space

### Fallback Behavior
When storage detection fails or returns unrealistic values:
- The system returns `storageAvailable: 0`
- This means "unknown", not "no storage"
- Features with `minStorage: 0` (like text-chat) still work
- Features requiring storage (image-generation, vision) may be disabled

## Recommendations

### For Chrome Users
- Most accurate hardware detection
- RAM detection works (up to 8 GB cap)
- Storage detection is reliable

### For Brave Users
- RAM detection works (up to 8 GB cap)
- Storage detection may show 0 (unknown)
- Consider using Chrome for features requiring storage detection

### For Firefox Users
- RAM detection unavailable (returns null)
- Storage detection may be restricted
- Features with unknown requirements are not disabled

## Clearing Cache

To force re-detection of hardware:
1. Open browser console
2. Run: `localStorage.removeItem('hardware-profile-cache')`
3. Reload the page

Or use the application's troubleshooting tools to clear the cache.

## Technical Details

### Detection Methods Logged
- `ramDetectionMethod`: 'deviceMemory' | 'performance' | 'unknown'
- `storageDetectionMethod`: 'estimate' | 'fallback' | 'unknown'
- `browserName`: Chrome | Brave | Firefox | Edge | Safari

### Console Logs
The application logs detailed hardware detection information:
```
[RAM Detection] navigator.deviceMemory reports 4 GB
[RAM Detection] Note: This API is privacy-limited and caps at 8GB. Actual RAM may be higher.
[Storage Detection] quota=1073741824, usage=0, available=1073741824 bytes (1.00 GB)
```

Check the browser console for detailed detection logs.
